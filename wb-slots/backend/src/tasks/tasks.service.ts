import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, RunStatus } from '@prisma/client';
import { WBClientFactory } from '../lib/wb-client';
import { decrypt } from '../lib/encryption';
import { AppLoggerService } from '../lib/logger.service';

export interface SlotSearchParams {
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  isSortingCenter?: boolean;
  updateInterval?: number;
}

export interface SlotSearchResult {
  success: boolean;
  foundSlots: any[];
  totalSearches: number;
  searchTime: number;
  filters: SlotSearchParams;
  error?: string;
  timestamp: string;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private appLogger: AppLoggerService
  ) {}

  async create(userId: string, createTaskDto: CreateTaskDto): Promise<Task> {
    return this.prisma.task.create({
      data: {
        userId,
        name: createTaskDto.name,
        description: createTaskDto.description,
        scheduleCron: createTaskDto.schedule,
        filters: createTaskDto.filters,
        enabled: createTaskDto.isActive ?? true,
        autoBook: createTaskDto.autoBook ?? false,
        autoBookSupplyId: createTaskDto.autoBookSupplyId,
        chosenSupplyId: createTaskDto.chosenSupplyId,
        retryPolicy: { maxRetries: 3, backoffMs: 5000 }, // Default retry policy
      },
      include: {
        runs: true,
      },
    });
  }

  async findAll(userId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { userId },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Last 5 runs
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        runs: {
          include: {
            logs: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Доступ запрещен');
    }

    return task;
  }

  async update(id: string, userId: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Доступ запрещен');
    }

    return this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
      include: {
        runs: true,
      },
    });
  }

  async remove(id: string, userId: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Доступ запрещен');
    }

    return this.prisma.task.delete({
      where: { id },
    });
  }

  async runTask(id: string, userId: string) {
    const task = await this.findOne(id, userId);

    // Create a new run
    const run = await this.prisma.run.create({
      data: {
        task: {
          connect: { id: id }
        },
        user: {
          connect: { id: userId }
        },
        status: RunStatus.QUEUED,
        startedAt: new Date(),
      },
    });

    // TODO: Add task to queue for processing
    // This would integrate with BullMQ to schedule the actual task execution

    return run;
  }

  async getTaskStats(userId: string) {
    const totalTasks = await this.prisma.task.count({
      where: { userId },
    });

    const activeTasks = await this.prisma.task.count({
      where: { 
        userId,
        // Note: isActive field doesn't exist in the schema, removing this filter
      },
    });

    const completedRuns = await this.prisma.run.count({
      where: {
        task: { userId },
        status: RunStatus.SUCCESS,
      },
    });

    const failedRuns = await this.prisma.run.count({
      where: {
        task: { userId },
        status: RunStatus.FAILED,
      },
    });

    return {
      totalTasks,
      activeTasks,
      completedRuns,
      failedRuns,
    };
  }

  /**
   * Поиск слотов с фильтрацией на backend
   */
  async searchSlots(userId: string, params: SlotSearchParams): Promise<SlotSearchResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    this.logger.log(`Starting slot search for user ${userId}`, {
      params,
      timestamp,
    });

    try {
      // Получаем токен пользователя
      const suppliesToken = await this.prisma.userToken.findFirst({
        where: {
          userId,
          category: 'SUPPLIES',
          isActive: true,
        },
      });

      if (!suppliesToken) {
        const error = 'No active supplies token found. Please add a SUPPLIES token in settings.';
        this.logger.error(error, { userId, timestamp });
        
        return {
          success: false,
          foundSlots: [],
          totalSearches: 0,
          searchTime: Date.now() - startTime,
          filters: params,
          error,
          timestamp,
        };
      }

      // Расшифровываем токен
      const decryptedToken = decrypt(suppliesToken.tokenEncrypted);

      // Создаем WB клиент
      const wbClient = WBClientFactory.createSuppliesClient(decryptedToken);

      // Выполняем поиск слотов
      const searchResult = await wbClient.searchAvailableSlots(
        params.warehouseIds,
        params.boxTypeIds,
        params.dateFrom,
        params.dateTo,
        params.coefficientMin,
        true // allowUnload
      );

      // Применяем фильтры на backend
      const filteredSlots = searchResult.filter((slot: any) => {
        // Фильтр по коэффициенту
        const coefficient = slot.coefficient || 0;
        if (coefficient < params.coefficientMin || coefficient > params.coefficientMax) {
          return false;
        }

        // Фильтр по складам
        if (params.warehouseIds.length > 0 && !params.warehouseIds.includes(slot.warehouseID)) {
          return false;
        }

        // Фильтр по типам коробов
        if (params.boxTypeIds.length > 0 && !params.boxTypeIds.includes(slot.boxTypeID)) {
          return false;
        }

        // Фильтр по датам
        const slotDate = new Date(slot.date);
        const fromDate = new Date(params.dateFrom);
        const toDate = new Date(params.dateTo);
        
        if (slotDate < fromDate || slotDate > toDate) {
          return false;
        }

        // Фильтр по сортировочному центру
        if (params.isSortingCenter !== undefined && slot.isSortingCenter !== params.isSortingCenter) {
          return false;
        }

        return true;
      });

      const searchTime = Date.now() - startTime;
      const foundSlotsCount = filteredSlots.length;

      // Логируем результаты поиска
      if (foundSlotsCount === 0) {
        await this.appLogger.logEmptyResults(userId, params, searchTime);
      } else {
        await this.appLogger.logSearchSuccess(userId, foundSlotsCount, searchTime, params);
      }

      return {
        success: true,
        foundSlots: filteredSlots.map(slot => ({
          warehouseId: slot.warehouseID,
          warehouseName: slot.warehouseName,
          date: slot.date,
          timeSlot: '09:00-18:00', // WB API не предоставляет временные слоты
          coefficient: slot.coefficient,
          available: slot.allowUnload,
          boxTypes: [slot.boxTypeID],
          boxTypeName: slot.boxTypeName,
          isSortingCenter: slot.isSortingCenter,
          storageCoef: slot.storageCoef,
          deliveryCoef: slot.deliveryCoef,
        })),
        totalSearches: 1,
        searchTime,
        filters: params,
        timestamp,
      };

    } catch (error) {
      const searchTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Логируем ошибку поиска
      await this.appLogger.logSearchError(userId, errorMessage, params, searchTime);

      return {
        success: false,
        foundSlots: [],
        totalSearches: 0,
        searchTime,
        filters: params,
        error: errorMessage,
        timestamp,
      };
    }
  }
}
