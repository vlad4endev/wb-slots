import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WBClientFactory } from '../lib/wb-client';
import { decrypt } from '../lib/encryption';
import { AppLoggerService } from '../lib/logger.service';

export interface Supply {
  id: string;
  name: string;
  status: string;
  warehouseId: number;
  boxTypeId: number;
  supplyDate?: string;
  factDate?: string;
  createdAt: string;
  updatedAt: string;
  goods?: any[];
}

export interface GetSuppliesParams {
  limit: number;
  offset: number;
}

export interface GetSuppliesResult {
  success: boolean;
  supplies: Supply[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
}

@Injectable()
export class SuppliesService {
  private readonly logger = new Logger(SuppliesService.name);

  constructor(
    private prisma: PrismaService,
    private appLogger: AppLoggerService
  ) {}

  /**
   * Получение списка поставок пользователя
   */
  async getSupplies(userId: string, params: GetSuppliesParams): Promise<GetSuppliesResult> {
    const startTime = Date.now();
    
    this.logger.log(`Getting supplies for user ${userId}`, {
      params,
      timestamp: new Date().toISOString(),
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
        this.logger.error(error, { userId });
        
        return {
          success: false,
          supplies: [],
          pagination: {
            limit: params.limit,
            offset: params.offset,
            total: 0,
            hasMore: false,
          },
          error,
        };
      }

      // Расшифровываем токен
      console.log('🔐 Encrypted token length:', suppliesToken.tokenEncrypted.length);
      const decryptedToken = decrypt(suppliesToken.tokenEncrypted);
      console.log('🔓 Decrypted token length:', decryptedToken.length);
      console.log('🔓 Decrypted token preview:', decryptedToken.substring(0, 20) + '...');

      // Создаем WB клиент
      const wbClient = WBClientFactory.createSuppliesClient(decryptedToken);

      // Используем только статус 1 (не запланировано)
      const statusIDs: number[] = [1];

      // Получаем поставки из WB API с фильтрацией по статусам
      console.log('🚀 Вызываем wbClient.getSupplies с параметрами:', {
        limit: params.limit,
        offset: params.offset,
        statusIDs: statusIDs
      });
      
      let wbSupplies;
      try {
        wbSupplies = await wbClient.getSupplies(
          params.limit, 
          params.offset, 
          statusIDs
        );
        
        console.log('✅ WB API ответ получен:', {
          suppliesCount: wbSupplies?.length || 0,
          firstSupply: wbSupplies?.[0] || null
        });
      } catch (wbError) {
        console.error('❌ Ошибка WB API:', wbError);
        const errorMessage = wbError instanceof Error ? wbError.message : String(wbError);
        throw new Error(`WB API Error: ${errorMessage}`);
      }

      // Дополнительная фильтрация не нужна, так как WB API уже фильтрует по статусам
      const filteredSupplies = wbSupplies;

      // Преобразуем в наш формат
      const supplies: Supply[] = filteredSupplies.map(supply => ({
        id: supply.id,
        name: supply.name || `Поставка ${supply.id}`,
        status: supply.status,
        warehouseId: supply.warehouseId,
        boxTypeId: supply.boxTypeId,
        supplyDate: supply.supplyDate,
        factDate: supply.factDate,
        createdAt: supply.createdAt,
        updatedAt: supply.updatedAt,
        goods: supply.goods || [],
      }));

      const searchTime = Date.now() - startTime;

      // Логируем успешное получение поставок
      await this.appLogger.logSlotSearch('INFO', 'Supplies fetched successfully', {
        userId,
        foundSlotsCount: supplies.length,
        searchTime,
        filters: params,
      });

      this.logger.log(`Supplies fetched successfully`, {
        userId,
        suppliesCount: supplies.length,
        searchTime,
        params,
      });

      return {
        success: true,
        supplies,
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total: supplies.length,
          hasMore: supplies.length === params.limit, // Предполагаем, что есть еще, если получили полный лимит
        },
      };

    } catch (error) {
      const searchTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Логируем ошибку получения поставок
      await this.appLogger.logSearchError(userId, errorMessage, params, searchTime);

      this.logger.error(`Failed to get supplies for user ${userId}`, {
        error: errorMessage,
        params,
        searchTime,
      });

      return {
        success: false,
        supplies: [],
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total: 0,
          hasMore: false,
        },
        error: errorMessage,
      };
    }
  }
}
