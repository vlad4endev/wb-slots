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
    console.log('🚀 Starting continuous search with config:', {
      taskId: config.taskId,
      userId: config.userId,
      runId: config.runId,
      warehouseIds: config.warehouseIds,
      boxTypeIds: config.boxTypeIds,
      coefficientMin: config.coefficientMin,
      coefficientMax: config.coefficientMax,
      dateFrom: config.dateFrom,
      dateTo: config.dateTo
    });

    if (this.isSearching && this.currentSearchId === config.taskId) {
      console.log('❌ Search is already in progress for this task, throwing error');
      throw new Error('Search is already in progress for this task');
    }

    if (this.isSearching && this.currentSearchId !== config.taskId) {
      console.log('⚠️ Another search is in progress, stopping it first');
      this.stopRequested = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Setting search state to active');
    this.isSearching = true;
    this.stopRequested = false;
    this.currentSearchId = config.taskId;

    const startTime = Date.now();
    let totalSearches = 0;
    let foundSlots: FoundSlot[] = [];
    let searchStopped = false;

    try {
      console.log('🔍 Получение задачи из базы данных...');
      const task = await prisma.task.findUnique({
        where: { id: config.taskId },
        include: { user: true },
      });
      if (!task) throw new Error('Task not found');
      console.log(`✅ Задача найдена: ${task.name} (${task.taskNumber})`);

      console.log('🔑 Получение SUPPLIES токена из настроек пользователя...');
      
      // Получаем токен напрямую из базы данных, как в настройках
      const suppliesToken = await prisma.userToken.findFirst({
        where: { 
          userId: config.userId, 
          category: 'SUPPLIES', 
          isActive: true 
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!suppliesToken) {
        throw new Error('No active SUPPLIES token found in user settings. Please add a SUPPLIES token in Settings → Tokens');
      }
      
      console.log(`✅ SUPPLIES токен найден в настройках: ${suppliesToken.id}`);

      console.log('🔓 Расшифровка токена...');
      let decryptedToken;
      try {
        decryptedToken = decrypt(suppliesToken.tokenEncrypted);
        console.log('✅ Токен расшифрован');
      } catch (decryptError) {
        console.error('❌ Ошибка расшифровки токена:', decryptError);
        console.error('📊 Детали токена:', {
          tokenId: suppliesToken.id,
          tokenLength: suppliesToken.tokenEncrypted?.length || 0,
          tokenPreview: suppliesToken.tokenEncrypted?.substring(0, 50) + '...' || 'undefined',
          createdAt: suppliesToken.createdAt,
          isActive: suppliesToken.isActive
        });
        throw new Error(`Token decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`);
      }

      console.log('🌐 Создание WB клиента...');
      let wbClient;
      try {
        wbClient = WBClientFactory.createSuppliesClient(decryptedToken);
        console.log('✅ WB клиент создан');
      } catch (clientError) {
        console.error('❌ Ошибка создания WB клиента:', clientError);
        throw new Error(`Failed to create WB client: ${clientError instanceof Error ? clientError.message : String(clientError)}`);
      }

      // Обновляем статусы
      try {
        await prisma.task.update({ where: { id: config.taskId }, data: { status: 'RUNNING' } as any });
      } catch { /* поле status может отсутствовать */ }

      await prisma.run.update({ where: { id: config.runId }, data: { status: 'RUNNING' } });

      await this.logRunMessage(config.runId, 'INFO', `Starting continuous slot search for task ${task.id}`, { taskId: config.taskId });

      const maxCycles = config.maxSearchCycles ?? 1000;
      const searchDelay = config.searchDelay ?? 30000;
      const maxExecutionTime = config.maxExecutionTime ?? 7 * 24 * 60 * 60 * 1000;
      const continueUntilFound = false; // Останавливаем поиск после находки
      const minSlotsRequired = 1; // Минимум 1 слот для остановки
      const maxConsecutiveEmptyCycles = config.maxConsecutiveEmptyCycles ?? 10;

      console.log(`⚙️ Параметры поиска:`, {
        maxCycles,
        searchDelay: `${searchDelay}ms`,
        maxExecutionTime: `${maxExecutionTime}ms`,
        continueUntilFound,
        minSlotsRequired,
        maxConsecutiveEmptyCycles
      });

      let consecutiveEmptyCycles = 0;

      console.log(`🚀 Начинаем цикл поиска слотов (максимум ${maxCycles} циклов)`);

      for (let cycle = 1; cycle <= maxCycles; cycle++) {
        if (this.stopRequested) break;
        if (Date.now() - startTime > maxExecutionTime) break;

        try {
          totalSearches++;
          console.log(`🔄 Starting search cycle ${cycle}/${maxCycles} for task ${config.taskId}`);

          const searchResult = await wbClient.searchAvailableSlots(
            config.warehouseIds,
            config.boxTypeIds,
            config.dateFrom,
            config.dateTo,
            config.coefficientMin,
            true
          );
          
          console.log(`📊 Search cycle ${cycle} completed: ${searchResult?.length || 0} slots found`);
          console.log(`🔍 searchResult type:`, typeof searchResult, 'isArray:', Array.isArray(searchResult));

          if (!searchResult || !Array.isArray(searchResult)) {
            console.warn(`⚠️ searchResult is not an array:`, searchResult);
            consecutiveEmptyCycles++;
            continue;
          }

          console.log(`🔍 Начинаем дополнительную фильтрацию ${searchResult.length} слотов...`);
          console.log(`🔍 Параметры фильтрации:`);
          console.log(`   - Максимальный коэффициент: ${config.coefficientMax}`);
          console.log(`   - Разгрузка разрешена: true (только с allowUnload: true)`);
          
          const validSlots = searchResult.filter(slot => 
            (slot.coefficient ?? 0) <= config.coefficientMax && 
            slot.allowUnload === true
          );

          console.log(`🔍 Результат фильтрации: ${searchResult.length} → ${validSlots.length} слотов`);
          console.log(`🔍 Фильтры: коэффициент <= ${config.coefficientMax}, allowUnload === true`);

          if (validSlots.length > 0) {
            console.log(`🎯 Найдено ${validSlots.length} подходящих слотов в цикле ${cycle}:`);
            
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

              console.log(`  📦 Слот: ${slot.warehouseName} (${slot.warehouseID}) - ${slot.date} - Коэффициент: ${slot.coefficient}`);

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
                console.log(`  ✅ Слот сохранен в базу данных`);
              } catch (dbError) {
                console.error('❌ Ошибка сохранения слота:', dbError);
              }
            }

            consecutiveEmptyCycles = 0;

            if (foundSlots.length >= minSlotsRequired) {
              await this.logRunMessage(config.runId, 'INFO', `Found enough slots (${foundSlots.length}/${minSlotsRequired}), stopping search`);
              console.log(`🎉 Найдено достаточно слотов (${foundSlots.length}/${minSlotsRequired}), останавливаем поиск`);
              
              // Отправляем уведомление пользователю
              try {
                await this.sendNotification(config.userId, `Найдено ${foundSlots.length} слотов! Поиск остановлен.`, foundSlots.length, foundSlots);
              } catch (notifyError) {
                console.error('Ошибка отправки уведомления:', notifyError);
              }
              
              searchStopped = true;
              break;
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
          console.error(`❌ Search error in cycle ${cycle}:`, searchError);
          await this.logRunMessage(config.runId, 'ERROR', `Search error in cycle ${cycle}: ${searchError instanceof Error ? searchError.message : String(searchError)}`, {
            error: searchError,
            cycle,
            warehouseIds: config.warehouseIds,
            boxTypeIds: config.boxTypeIds,
            timestamp: new Date().toISOString()
          });
          
          // Если это критическая ошибка, останавливаем поиск
          if (searchError instanceof Error && (
            searchError.message.includes('Rate limit') ||
            searchError.message.includes('Unauthorized') ||
            searchError.message.includes('Forbidden') ||
            searchError.message.includes('Network error')
          )) {
            console.error(`🚨 Critical error detected, stopping search: ${searchError.message}`);
            break;
          }
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
      console.error('❌ Критическая ошибка в continuous search:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      
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
      // Проверяем, существует ли run в базе данных
      const run = await prisma.run.findUnique({
        where: { id: runId }
      });
      
      if (!run) {
        console.warn(`⚠️ Run ${runId} not found, skipping log message: ${message}`);
        return;
      }
      
      await prisma.runLog.create({ 
        data: { 
          runId, 
          level, 
          message, 
          meta: meta || {} 
        } 
      });
    } catch (error) {
      console.error('Failed to log run message:', error);
      // Не выбрасываем ошибку, чтобы не прерывать основной процесс
    }
  }

  private async sendNotification(userId: string, message: string, slotsCount: number = 0, foundSlots: any[] = []): Promise<void> {
    try {
      // Используем новый сервис интеграции Telegram
      const { telegramIntegrationService } = await import('@/lib/services/telegram-integration-service');
      
      console.log('📱 Попытка отправки Telegram уведомления через новую систему...');

      // Отправляем уведомление через новый сервис интеграции
      const success = await telegramIntegrationService.notifySlotsFound({
        userId,
        taskId: 'continuous-search', // Для непрерывного поиска используем специальный ID
        taskName: 'Непрерывный поиск слотов',
        slots: foundSlots.map(slot => ({
          warehouseId: slot.warehouseId,
          warehouseName: slot.warehouseName || `Склад ${slot.warehouseId}`,
          date: slot.date,
          coefficient: slot.coefficient,
          boxTypes: slot.boxTypes || []
        }))
      });
      
      if (success) {
        console.log(`✅ Telegram уведомление отправлено пользователю ${userId} о ${foundSlots.length} слотах`);
      } else {
        console.warn(`⚠️ Не удалось отправить Telegram уведомление пользователю ${userId}`);
      }
    } catch (error) {
      console.error('❌ Ошибка отправки Telegram уведомления:', error);
    }
  }

}

export const continuousSlotSearchService = new ContinuousSlotSearchService();
