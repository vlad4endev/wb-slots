import { BaseWBClient } from './base-client';
import { 
  WBCoefficient, 
  WBWarehouse, 
  WBSupply, 
  WBGood, 
  WBAcceptanceOptions,
  WBAPIResponse 
} from './types';

export class WBSuppliesClient extends BaseWBClient {
  constructor(token: string) {
    super(token, 'https://supplies-api.wildberries.ru');
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
    const params: Record<string, any> = {
      warehouseIDs: warehouseIds.join(','), // Исправлено: warehouseIDs вместо warehouseIds
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
    console.log(`🌐 WB API запрос: GET /api/v1/acceptance/coefficients`);
    console.log(`📋 Параметры:`, params);
    console.log(`🕐 Время запроса: ${new Date().toISOString()}`);
    console.log(`🏪 Склады: ${warehouseIds.join(', ')}`);
    console.log(`📅 Период: ${dateFrom || 'не указано'} - ${dateTo || 'не указано'}`);
    console.log(`🏭 Сортировочный центр: ${isSortingCenter ? 'Да' : 'Нет'}`);
    
    // Показываем полный curl запрос для отладки
    let curlCommand = `curl -G "https://supplies-api.wildberries.ru/api/v1/acceptance/coefficients" \\
  -H "Authorization:${this.token.substring(0, 10)}..." \\
  --data-urlencode "warehouseIDs=${warehouseIds.join(',')}"`;
    
    if (dateFrom) {
      curlCommand += ` \\
  --data-urlencode "dateFrom=${dateFrom}"`;
    }
    if (dateTo) {
      curlCommand += ` \\
  --data-urlencode "dateTo=${dateTo}"`;
    }
    if (isSortingCenter !== undefined) {
      curlCommand += ` \\
  --data-urlencode "isSortingCenter=${isSortingCenter}"`;
    }
    
    console.log(`🔧 Эквивалентный curl запрос:`);
    console.log(curlCommand);

    const response = await this.get<WBCoefficient[]>('/api/v1/acceptance/coefficients', params);
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
        min: Math.min(...coefficients.map(c => c.coefficient)),
        max: Math.max(...coefficients.map(c => c.coefficient)),
        avg: coefficients.reduce((sum, c) => sum + c.coefficient, 0) / coefficients.length,
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
   * Get supplies list
   * @param limit Maximum number of supplies to return (default: 1000)
   * @param offset Offset for pagination (default: 0)
   */
  async getSupplies(limit: number = 1000, offset: number = 0): Promise<WBSupply[]> {
    const params = {
      limit,
      offset,
    };

    const response = await this.post<WBSupply[]>('/api/v1/supplies', {}, params);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get supplies');
    }

    return response.data || [];
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
    // Get coefficients for all warehouses
    const coefficients = await this.getCoefficients(warehouseIds, dateFrom, dateTo);
    
    // Filter by criteria
    return coefficients.filter(coeff => 
      warehouseIds.includes(coeff.warehouseID) &&
      coeff.coefficient >= coefficientThreshold &&
      coeff.allowUnload === allowUnload
    );
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
}
