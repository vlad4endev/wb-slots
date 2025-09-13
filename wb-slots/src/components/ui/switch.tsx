import { PrismaClient } from '@prisma/client';
import { decrypt } from '@/lib/encryption';
import { WBClientFactory } from '@/lib/wb-client';
import { AutoBookingService } from './auto-booking-service';
import { TelegramService } from '@/lib/telegram-service';

const prisma = new PrismaClient();

// Singleton instance для TelegramService
let telegramServiceInstance: TelegramService | null = null;

function getTelegramService(): TelegramService {
  if (!telegramServiceInstance) {
    telegramServiceInstance = new TelegramService();
  }
  return telegramServiceInstance;
}

export interface ContinuousSearchConfig {
  taskId: string;
  userId: string;
  runId: string;
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  isSortingCenter?: boolean;
  maxSearchCycles?: number;
  searchDelay?: number;
  maxExecutionTime?: number;
  autoBook?: boolean;
  autoBookSupplyId?: string;
  continueUntilFound?: boolean;
  minSlotsRequired?: number;
  maxConsecutiveEmptyCycles?: number;
}

export interface FoundSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  available: boolean;
  boxTypes: number[];
  supplyId?: string;
}

export interface ContinuousSearchResult {
  success: boolean;
  foundSlots: FoundSlot[];
  totalSearches: number;
  searchTime: number;
  stoppedEarly: boolean;
  error?: string;
  runId: string;
  taskId?: string;
  consecutiveEmptyCycles?: number;
  minSlotsRequired?: number;
  continueUntilFound?: boolean;
}

export class ContinuousSlotSearchService {
  private isSearching = false;
  private stopRequested = false;
  private currentSearchId: string | null = null;

  async startContinuousSearch(config: ContinuousSearchConfig): Promise<ContinuousSearchResult> {
    if (this.isSearching && this.currentSearchId === config.taskId) {
      throw new Error('Search is already in progress for this task');
    }

    if (this.isSearching && this.currentSearchId !== config.taskId) {
      this.stopRequested = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isSearching = true;
    this.stopRequested = false;
    this.currentSearchId = config.taskId;

    const startTime = Date.now();
    let totalSearches = 0;
    const foundSlots: FoundSlot[] = [];

    try {
      const task = await prisma.task.findUnique({
        where: { id: config.taskId },
        include: { user: true },
      });
      if (!task) throw new Error('Task not found');

      const suppliesToken = await prisma.userToken.findFirst({
        where: { userId: config.userId, category: 'SUPPLIES', isActive: true },
      });
      if (!suppliesToken) throw new Error('No active SUPPLIES token found');

      const decryptedToken = decrypt(suppliesToken.tokenEncrypted);
      const wbClient = WBClientFactory.createSuppliesClient(decryptedToken);

      // Обновляем статусы
      try {
        await prisma.task.update({ where: { id: config.taskId }, data: { status: 'RUNNING' } as any });
      } catch { /* поле status может отсутствовать */ }

      await prisma.run.update({ where: { id: config.runId }, data: { status: 'RUNNING' } });

      await this.logRunMessage(config.runId, 'INFO', `Starting continuous slot search for task ${task.id}`, { taskId: config.taskId });

      const maxCycles = config.maxSearchCycles ?? 1000;
      const searchDelay = config.searchDelay ?? 30000;
      const maxExecutionTime = config.maxExecutionTime ?? 7 * 24 * 60 * 60 * 1000;
      const continueUntilFound = config.continueUntilFound ?? true;
      const minSlotsRequired = config.minSlotsRequired ?? 1;
      const maxConsecutiveEmptyCycles = config.maxConsecutiveEmptyCycles ?? 10;

      let consecutiveEmptyCycles = 0;

      for (let cycle = 1; cycle <= maxCycles; cycle++) {
        if (this.stopRequested) break;
        if (Date.now() - startTime > maxExecutionTime) break;

        try {
          totalSearches++;

          const searchResult = await wbClient.searchAvailableSlots(
            config.warehouseIds,
            config.boxTypeIds,
            config.dateFrom,
            config.dateTo,
            config.coefficientMin,
            true
          );

          const validSlots = searchResult.filter(slot => (slot.coefficient ?? 0) <= config.coefficientMax);

          if (validSlots.length > 0) {
            for (const slot of validSlots) {
              const foundSlot: FoundSlot = {
                warehouseId: slot.warehouseID,
                warehouseName: slot.warehouseName ?? `Склад ${slot.warehouseID}`,
                date: slot.date,
                timeSlot: '09:00-18:00',
                coefficient: slot.coefficient ?? 0,
                available: true,
                boxTypes: [slot.boxTypeID],
              };
              foundSlots.push(foundSlot);

              try {
                await prisma.foundSlot.create({
                  data: {
                    runId: config.runId,
                    userId: config.userId,
                    warehouseId: slot.warehouseID,
                    warehouseName: slot.warehouseName ?? `Склад ${slot.warehouseID}`,
                    date: slot.date,
                    timeSlot: '09:00-18:00',
                    coefficient: slot.coefficient ?? 0,
                    available: true,
                    boxTypes: [slot.boxTypeID],
                  },
                });
              } catch (dbError) {
                console.error('Error saving found slot:', dbError);
              }
            }

            consecutiveEmptyCycles = 0;

            if (foundSlots.length >= minSlotsRequired) {
              await this.logRunMessage(config.runId, 'INFO', `Found enough slots (${foundSlots.length}/${minSlotsRequired}), stopping search`);
              if (!continueUntilFound) break;
            }

          } else {
            consecutiveEmptyCycles++;
            await this.logRunMessage(config.runId, 'DEBUG', `No valid slots found in cycle ${cycle} (${consecutiveEmptyCycles}/${maxConsecutiveEmptyCycles} consecutive empty cycles)`);
            if (consecutiveEmptyCycles >= maxConsecutiveEmptyCycles) break;
          }

          if (cycle < maxCycles && !this.stopRequested && consecutiveEmptyCycles < maxConsecutiveEmptyCycles) {
            await new Promise(resolve => setTimeout(resolve, searchDelay));
          }
        } catch (searchError) {
          await this.logRunMessage(config.runId, 'ERROR', `Search error in cycle ${cycle}: ${searchError}`);
        }
      }

      const finalStatus = foundSlots.length > 0 ? 'SUCCESS' : 'FAILED';
      try {
        await prisma.task.update({
          where: { id: config.taskId },
          data: { status: finalStatus, enabled: foundSlots.length === 0 } as any,
        });
      } catch {}

      await prisma.run.update({
        where: { id: config.runId },
        data: {
          status: finalStatus,
          finishedAt: new Date(),
          foundSlots: foundSlots.length,
          summary: {
            foundSlots: foundSlots.length,
            totalSearches,
            searchTime: Date.now() - startTime,
            stoppedEarly: this.stopRequested,
          },
        },
      });

      return {
        success: true,
        foundSlots,
        totalSearches,
        searchTime: Date.now() - startTime,
        stoppedEarly: this.stopRequested,
        runId: config.runId,
        taskId: config.taskId,
        consecutiveEmptyCycles,
        minSlotsRequired,
        continueUntilFound,
      };
    } catch (error) {
      await prisma.run.update({
        where: { id: config.runId },
        data: { status: 'FAILED', finishedAt: new Date() },
      });
      return {
        success: false,
        foundSlots: [],
        totalSearches,
        searchTime: Date.now() - startTime,
        stoppedEarly: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        runId: config.runId,
      };
    } finally {
      this.isSearching = false;
      this.currentSearchId = null;
    }
  }

  async stopSearch(): Promise<void> {
    if (this.isSearching) {
      this.stopRequested = true;
      await this.logRunMessage(this.currentSearchId ?? '', 'INFO', 'Stop requested for continuous search');
    }
  }

  isSearchInProgress(): boolean {
    return this.isSearching;
  }

  getCurrentSearchId(): string | null {
    return this.currentSearchId;
  }

  private async logRunMessage(runId: string, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any): Promise<void> {
    try {
      await prisma.runLog.create({ data: { runId, level, message, meta: meta || {} } });
    } catch (error) {
      console.error('Failed to log run message:', error);
    }
  }
}

export const continuousSlotSearchService = new ContinuousSlotSearchService();
