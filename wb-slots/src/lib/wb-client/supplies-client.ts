import { BaseWBClient } from './base-client';
import { 
  WBCoefficient, 
  WBWarehouse, 
  WBSupply, 
  WBGood, 
  WBAcceptanceOptions,
  WBAPIResponse 
} from './types';
import { DataExtractionOptions, ProcessedResponse } from './response-processor';
import { PaginationRequest, PaginationResult, AutoPaginationOptions } from './pagination-manager';

export class WBSuppliesClient extends BaseWBClient {
  constructor(token: string, userId?: string) {
    super(token, 'https://supplies-api.wildberries.ru', { userId });
  }

  /**
   * Get acceptance coefficients for warehouses
   * @param warehouseIds Array of warehouse IDs
   * @param dateFrom Start date (ISO string)
   * @param dateTo End date (ISO string)
   */
  async getCoefficients(
    warehouseIds: number[],
    dateFrom?: string,
    dateTo?: string,
    isSortingCenter?: boolean
  ): Promise<WBCoefficient[]> {
    // Согласно официальной документации Wildberries API
    const params: Record<string, any> = {
      warehouseIDs: warehouseIds.join(','), // Правильное название параметра
    };

    if (dateFrom) {
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      params.dateTo = dateTo;
    }
    if (isSortingCenter !== undefined) {
      params.isSortingCenter = isSortingCenter;
    }

    const startTime = Date.now();
    console.log(`🌐 WB API запрос: POST /api/v1/acceptance/coefficients`);
    console.log(`📋 Параметры:`, params);
    console.log(`🕐 Время запроса: ${new Date().toISOString()}`);
    console.log(`🏪 Склады: ${warehouseIds.join(', ')}`);
    console.log(`📅 Период: ${dateFrom || 'не указано'} - ${dateTo || 'не указано'}`);
    console.log(`🏭 Сортировочный центр: ${isSortingCenter ? 'Да' : 'Нет'}`);
    
    // Согласно официальной документации Wildberries API, используем POST запрос
    const requestBody = {
      warehouseIDs: warehouseIds,
      dateFrom: dateFrom || new Date().toISOString(),
      dateTo: dateTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isSortingCenter: isSortingCenter || false
    };
    
    // Показываем полный curl запрос для отладки
    let curlCommand = `curl -X POST "https://supplies-api.wildberries.ru/api/v1/acceptance/coefficients" \\
  -H "Authorization: ${this.token.substring(0, 10)}..." \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestBody)}'`;
    
    console.log(`🔧 Эквивалентный curl запрос:`);
    console.log(curlCommand);

    // Попробуем сначала POST, если не работает - GET
    let response;
    try {
      response = await this.post<WBCoefficient[]>('/api/v1/acceptance/coefficients', requestBody);
    } catch (error: any) {
      if (error.statusCode === 405) {
        console.log('⚠️ POST не поддерживается, пробуем GET запрос...');
        // Если POST не поддерживается, используем GET с query параметрами
        const queryParams = new URLSearchParams({
          warehouseIDs: warehouseIds.join(','),
          dateFrom: requestBody.dateFrom,
          dateTo: requestBody.dateTo,
          isSortingCenter: requestBody.isSortingCenter.toString()
        });
        
        response = await this.get<WBCoefficient[]>(`/api/v1/acceptance/coefficients?${queryParams}`);
      } else {
        throw error;
      }
    }
    const endTime = Date.now();
    const requestDuration = endTime - startTime;
    
    // WB API возвращает данные напрямую как массив, а не в объекте с полем data
    const coefficients = Array.isArray(response) ? response : (response.data || []);
    
    console.log(`📥 Ответ WB API получен за ${requestDuration}ms`);
    console.log(`📊 Статистика ответа:`, {
      error: response.error,
      errorText: response.errorText,
      dataLength: coefficients.length,
      hasData: coefficients.length > 0,
      requestDuration: `${requestDuration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Логируем первые несколько элементов для анализа
    if (coefficients.length > 0) {
      console.log(`📋 Пример данных из ответа (${coefficients.length} записей):`);
      console.log(JSON.stringify(coefficients[0], null, 2));
      
      // Показываем статистику по коэффициентам
      const coefficientStats = {
        min: coefficients.length > 0 ? Math.min(...coefficients.map(c => c.coefficient)) : 0,
        max: coefficients.length > 0 ? Math.max(...coefficients.map(c => c.coefficient)) : 0,
        avg: coefficients.length > 0 ? coefficients.reduce((sum, c) => sum + c.coefficient, 0) / coefficients.length : 0,
        available: coefficients.filter(c => c.allowUnload).length,
        total: coefficients.length
      };
      console.log(`📈 Статистика коэффициентов:`, coefficientStats);
    } else {
      console.log(`⚠️ WB API вернул пустой массив. Возможные причины:`);
      console.log(`   - Неправильные параметры запроса`);
      console.log(`   - Проблемы с авторизацией`);
      console.log(`   - Склад не имеет доступных слотов`);
      console.log(`   - Неправильный формат дат`);
      console.log(`   - Период поиска не содержит доступных дат`);
    }

    if (response.error) {
      throw new Error(response.errorText || 'Failed to get coefficients');
    }

    const result = coefficients;
    console.log(`✅ Успешно получено коэффициентов: ${result.length}`);
    
    return result;
  }

  /**
   * Get list of warehouses
   */
  async getWarehouses(): Promise<WBWarehouse[]> {
    const response = await this.get<WBWarehouse[]>('/api/v1/warehouses');
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get warehouses');
    }

    return response.data || [];
  }

  /**
   * Get acceptance options for specific goods
   * @param barcodes Array of product barcodes
   * @param quantities Array of quantities (same order as barcodes)
   */
  async getAcceptanceOptions(
    barcodes: string[],
    quantities: number[]
  ): Promise<WBAcceptanceOptions[]> {
    if (barcodes.length !== quantities.length) {
      throw new Error('Barcodes and quantities arrays must have the same length');
    }

    const data = barcodes.map((barcode, index) => ({
      barcode,
      quantity: quantities[index],
    }));

    const response = await this.post<WBAcceptanceOptions[]>('/api/v1/acceptance/options', data);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get acceptance options');
    }

    return response.data || [];
  }

  /**
   * Get supplies list with filters
   * @param limit Maximum number of supplies to return (default: 1000)
   * @param offset Offset for pagination (default: 0)
   * @param statusIDs Array of status IDs to filter (ignored - API doesn't support status filtering)
   * @param dateFrom Start date for filtering (ISO string)
   * @param dateTo End date for filtering (ISO string)
   */
  async getSupplies(
    limit: number = 1000, 
    offset: number = 0,
    statusIDs: number[] = [], // Игнорируем - API не поддерживает фильтрацию по статусам
    dateFrom?: string,
    dateTo?: string
  ): Promise<WBSupply[]> {
    const params = {
      limit,
      offset,
    };

    // Сначала проверим, работает ли API складов с тем же токеном
    console.log(`🔍 Проверяем доступность API складов...`);
    try {
      const warehousesResponse = await this.get<WBWarehouse[]>('/api/v1/warehouses');
      console.log(`✅ API складов работает, получено складов: ${warehousesResponse.data?.length || 0}`);
    } catch (warehouseError: any) {
      console.log(`❌ API складов не работает:`, warehouseError.message);
    }

    // Попробуем разные endpoints для получения поставок
    console.log(`🌐 WB API запрос: POST /api/v1/supplies`);
    console.log(`📋 Параметры:`, params);
    console.log(`ℹ️ Примечание: Пробуем POST запрос для получения поставок`);

    let response;
    try {
      // Сначала пробуем POST запрос с пустым телом
      response = await this.post<WBSupply[]>('/api/v1/supplies', {}, params);
    } catch (error: any) {
      console.log(`⚠️ POST /api/v1/supplies failed:`, error.message);
      
      if (error.code === 'NETWORK_ERROR') {
        console.log('🌐 Network error, пробуем другой домен...');
        // Пробуем основной API домен
        const mainApiClient = new BaseWBClient(this.token, 'https://api.wildberries.ru');
        try {
          response = await mainApiClient.get<WBSupply[]>('/api/v1/supplies', params);
        } catch (mainApiError: any) {
          console.log(`⚠️ Main API also failed:`, mainApiError.message);
          throw error; // Возвращаем оригинальную ошибку
        }
      } else if (error.statusCode === 404) {
        console.log('⚠️ POST /api/v1/supplies не найден, пробуем GET...');
        try {
          response = await this.get<WBSupply[]>('/api/v1/supplies', params);
        } catch (getError: any) {
          if (getError.statusCode === 404) {
            console.log('⚠️ GET /api/v1/supplies тоже не найден, пробуем /api/v3/supplies...');
            response = await this.get<WBSupply[]>('/api/v3/supplies', params);
          } else {
            throw getError;
          }
        }
      } else {
        throw error;
      }
    }
    
    console.log(`📊 WB API Response:`, {
      error: response.error,
      errorText: response.errorText,
      dataLength: response.data?.length || 0,
      hasData: response.data && response.data.length > 0,
      fullResponse: response
    });
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get supplies');
    }

    // WB API возвращает данные напрямую как массив, а не в объекте с полем data
    const supplies = Array.isArray(response) ? response : (response.data || []);
    console.log(`✅ Получено поставок: ${supplies.length}`);
    if (supplies.length > 0) {
      console.log(`📦 Первая поставка:`, supplies[0]);
    }
    
    return supplies;
  }

  /**
   * Get supply details by ID
   * @param supplyId Supply ID
   */
  async getSupplyDetails(supplyId: string): Promise<WBSupply> {
    const response = await this.get<WBSupply>(`/api/v1/supplies/${supplyId}`);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get supply details');
    }

    return response.data;
  }

  /**
   * Get supply goods by supply ID
   * @param supplyId Supply ID
   */
  async getSupplyGoods(supplyId: string): Promise<WBGood[]> {
    const response = await this.get<WBGood[]>(`/api/v1/supplies/${supplyId}/goods`);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get supply goods');
    }

    return response.data || [];
  }

  /**
   * Search for available slots based on criteria
   * @param warehouseIds Array of warehouse IDs to search
   * @param boxTypeIds Array of box type IDs to search
   * @param dateFrom Start date for search
   * @param dateTo End date for search
   * @param coefficientThreshold Minimum coefficient (0 or 1)
   * @param allowUnload Whether to allow unload
   */
  async searchAvailableSlots(
    warehouseIds: number[],
    boxTypeIds: number[],
    dateFrom: string,
    dateTo: string,
    coefficientThreshold: number = 0,
    allowUnload: boolean = true
  ): Promise<WBCoefficient[]> {
    try {
      // Get coefficients for all warehouses
      const coefficients = await this.getCoefficients(warehouseIds, dateFrom, dateTo);
      
      console.log(`🔍 Фильтрация слотов по параметрам:`);
      console.log(`   - Склады: [${warehouseIds.join(', ')}]`);
      console.log(`   - Типы коробок: [${boxTypeIds.join(', ')}]`);
      console.log(`   - Минимальный коэффициент: ${coefficientThreshold}`);
      console.log(`   - Разгрузка разрешена: ${allowUnload} (только с allowUnload: true)`);
      console.log(`   - Всего коэффициентов до фильтрации: ${coefficients?.length || 0}`);
      
      // Проверяем, что coefficients существует и является массивом
      if (!coefficients || !Array.isArray(coefficients)) {
        console.warn(`⚠️ Получены некорректные данные от API:`, coefficients);
        return [];
      }
      
      // Filter by basic criteria (warehouse and box type only)
      const filteredCoefficients = coefficients.filter(coeff => {
        if (!coeff || typeof coeff !== 'object') {
          console.warn(`⚠️ Некорректный коэффициент:`, coeff);
          return false;
        }
        
        return warehouseIds.includes(coeff.warehouseID) &&
               boxTypeIds.includes(coeff.boxTypeID);
      });
      
      console.log(`✅ Найдено слотов по складам и типам коробок: ${filteredCoefficients.length}`);
      console.log(`ℹ️ Дополнительная фильтрация по коэффициентам и allowUnload будет выполнена в continuous search service`);
      
      return filteredCoefficients;
    } catch (error) {
      console.error(`❌ Ошибка при поиске слотов:`, error);
      throw error;
    }
  }

  /**
   * Check if specific warehouse and box type combination is available
   * @param warehouseId Warehouse ID
   * @param boxTypeId Box type ID
   * @param date Date to check
   */
  async checkSlotAvailability(
    warehouseId: number,
    boxTypeId: number,
    date: string
  ): Promise<boolean> {
    try {
      const coefficients = await this.getCoefficients([warehouseId], date, date);
      const coeff = coefficients.find(c => c.warehouseID === warehouseId);
      
      return coeff ? coeff.coefficient >= 0 && coeff.allowUnload : false;
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return false;
    }
  }

  // ===== НОВЫЕ УЛУЧШЕННЫЕ МЕТОДЫ =====

  /**
   * Получает поставки с улучшенной обработкой ответа
   */
  async getSuppliesEnhanced(
    paginationRequest: PaginationRequest = {},
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBSupply[]>> {
    const params: Record<string, any> = {
      limit: paginationRequest.limit || 1000,
      offset: paginationRequest.offset || 0,
    };

    // Добавляем фильтры если указаны
    if (paginationRequest.sortBy) {
      params.sortBy = paginationRequest.sortBy;
    }
    if (paginationRequest.sortOrder) {
      params.sortOrder = paginationRequest.sortOrder;
    }

    return this.getWithProcessing<WBSupply[]>('/api/v1/supplies', params, {
      dataPath: 'data',
      paginationPath: 'pagination',
      validateFunction: (data) => Array.isArray(data),
      ...options
    });
  }

  /**
   * Получает поставки с пагинацией
   */
  async getSuppliesWithPagination(
    paginationRequest: PaginationRequest = {}
  ): Promise<PaginationResult<WBSupply>> {
    return this.requestWithPagination<WBSupply>({
      method: 'GET',
      url: '/api/v1/supplies'
    }, paginationRequest, {
      dataPath: 'data',
      paginationPath: 'pagination',
      validateFunction: (data) => Array.isArray(data)
    });
  }

  /**
   * Автоматически получает все поставки
   */
  async getAllSupplies(
    options: AutoPaginationOptions = {}
  ): Promise<WBSupply[]> {
    return this.autoPaginate<WBSupply>({
      method: 'GET',
      url: '/api/v1/supplies'
    }, {
      limit: 1000,
      page: 1
    }, options, {
      dataPath: 'data',
      validateFunction: (data) => Array.isArray(data)
    });
  }

  /**
   * Получает коэффициенты с улучшенной обработкой ответа
   */
  async getCoefficientsEnhanced(
    warehouseIds: number[],
    dateFrom?: string,
    dateTo?: string,
    isSortingCenter?: boolean,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBCoefficient[]>> {
    const params: Record<string, any> = {
      warehouseIDs: warehouseIds.join(','),
    };

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (isSortingCenter !== undefined) params.isSortingCenter = isSortingCenter;

    return this.postWithProcessing<WBCoefficient[]>('/api/v1/acceptance/coefficients', {}, params, {
      dataPath: 'data',
      validateFunction: (data) => Array.isArray(data),
      transformFunction: (data) => data.map((coeff: any) => ({
        ...coeff,
        warehouseID: parseInt(coeff.warehouseID),
        coefficient: parseFloat(coeff.coefficient),
        allowUnload: Boolean(coeff.allowUnload)
      })),
      ...options
    });
  }

  /**
   * Получает склады с улучшенной обработкой ответа
   */
  async getWarehousesEnhanced(
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBWarehouse[]>> {
    return this.getWithProcessing<WBWarehouse[]>('/api/v1/warehouses', {}, {
      dataPath: 'data',
      validateFunction: (data) => Array.isArray(data),
      transformFunction: (data) => data.map((warehouse: any) => ({
        id: parseInt(warehouse.id),
        name: warehouse.name,
        address: warehouse.address,
        city: warehouse.city,
        region: warehouse.region,
        country: warehouse.country
      })),
      ...options
    });
  }

  /**
   * Получает детали поставки с улучшенной обработкой ответа
   */
  async getSupplyDetailsEnhanced(
    supplyId: string,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBSupply>> {
    return this.getWithProcessing<WBSupply>(`/api/v1/supplies/${supplyId}`, {}, {
      dataPath: 'data',
      validateFunction: (data) => data && typeof data === 'object',
      ...options
    });
  }

  /**
   * Получает опции приемки с улучшенной обработкой ответа
   */
  async getAcceptanceOptionsEnhanced(
    barcodes: string[],
    quantities: number[],
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBAcceptanceOptions[]>> {
    const data = {
      barcodes,
      quantities
    };

    return this.postWithProcessing<WBAcceptanceOptions[]>('/api/v1/acceptance/options', data, {}, {
      dataPath: 'data',
      validateFunction: (data) => Array.isArray(data),
      ...options
    });
  }

  /**
   * Создает поставку с улучшенной обработкой ответа
   */
  async createSupplyEnhanced(
    supplyData: Partial<WBSupply>,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBSupply>> {
    return this.postWithProcessing<WBSupply>('/api/v1/supplies', supplyData, {}, {
      dataPath: 'data',
      validateFunction: (data) => data && typeof data === 'object',
      ...options
    });
  }

  /**
   * Обновляет поставку с улучшенной обработкой ответа
   */
  async updateSupplyEnhanced(
    supplyId: string,
    updateData: Partial<WBSupply>,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBSupply>> {
    return this.putWithProcessing<WBSupply>(`/api/v1/supplies/${supplyId}`, updateData, {}, {
      dataPath: 'data',
      validateFunction: (data) => data && typeof data === 'object',
      ...options
    });
  }

  /**
   * Удаляет поставку с улучшенной обработкой ответа
   */
  async deleteSupplyEnhanced(
    supplyId: string,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<boolean>> {
    return this.deleteWithProcessing<boolean>(`/api/v1/supplies/${supplyId}`, {}, {
      dataPath: 'data',
      validateFunction: (data) => typeof data === 'boolean',
      ...options
    });
  }

  /**
   * Получает товары поставки с улучшенной обработкой ответа
   */
  async getSupplyGoodsEnhanced(
    supplyId: string,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBGood[]>> {
    return this.getWithProcessing<WBGood[]>(`/api/v1/supplies/${supplyId}/goods`, {}, {
      dataPath: 'data',
      validateFunction: (data) => Array.isArray(data),
      ...options
    });
  }

  /**
   * Добавляет товары в поставку с улучшенной обработкой ответа
   */
  async addGoodsToSupplyEnhanced(
    supplyId: string,
    goods: WBGood[],
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<WBGood[]>> {
    return this.postWithProcessing<WBGood[]>(`/api/v1/supplies/${supplyId}/goods`, goods, {}, {
      dataPath: 'data',
      validateFunction: (data) => Array.isArray(data),
      ...options
    });
  }

  /**
   * Получает статистику поставок с улучшенной обработкой ответа
   */
  async getSuppliesStatsEnhanced(
    dateFrom?: string,
    dateTo?: string,
    options: DataExtractionOptions = {}
  ): Promise<ProcessedResponse<any>> {
    const params: Record<string, any> = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    return this.getWithProcessing('/api/v1/supplies/stats', params, {
      dataPath: 'data',
      validateFunction: (data) => data && typeof data === 'object',
      ...options
    });
  }
}
