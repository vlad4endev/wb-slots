import { WBSuppliesClient } from './supplies-client';
import { DataExtractionOptions } from './response-processor';
import { PaginationRequest, AutoPaginationOptions } from './pagination-manager';
import { apiLogger, LogLevel } from './enhanced-logger';

/**
 * Примеры использования улучшенного API клиента
 */
export class WBClientUsageExamples {
  private client: WBSuppliesClient;

  constructor(token: string, userId?: string) {
    this.client = new WBSuppliesClient(token, userId);
    
    // Настройка уровня логирования
    apiLogger.setLogLevel(LogLevel.INFO);
    apiLogger.setDetailedLogging(true);
  }

  /**
   * Пример 1: Получение поставок с улучшенной обработкой ответа
   */
  async exampleGetSuppliesEnhanced() {
    console.log('=== Пример 1: Получение поставок с улучшенной обработкой ===');
    
    try {
      const result = await this.client.getSuppliesEnhanced(
        { page: 1, limit: 50 }, // параметры пагинации
        {
          dataPath: 'data', // путь к данным в ответе
          validateFunction: (data) => Array.isArray(data), // валидация данных
          transformFunction: (data) => data.map(supply => ({
            ...supply,
            // Трансформация данных
            createdAt: new Date(supply.createdAt),
            updatedAt: new Date(supply.updatedAt)
          }))
        }
      );

      console.log('✅ Успешно получены поставки:', {
        count: result.data.length,
        pagination: result.pagination,
        metadata: result.metadata
      });

      return result;
    } catch (error) {
      console.error('❌ Ошибка получения поставок:', error);
      throw error;
    }
  }

  /**
   * Пример 2: Получение поставок с пагинацией
   */
  async exampleGetSuppliesWithPagination() {
    console.log('=== Пример 2: Получение поставок с пагинацией ===');
    
    try {
      const paginationRequest: PaginationRequest = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const result = await this.client.getSuppliesWithPagination(paginationRequest);

      console.log('✅ Поставки с пагинацией:', {
        dataCount: result.data.length,
        hasMore: result.hasMore,
        pagination: result.pagination
      });

      return result;
    } catch (error) {
      console.error('❌ Ошибка получения поставок с пагинацией:', error);
      throw error;
    }
  }

  /**
   * Пример 3: Автоматическое получение всех поставок
   */
  async exampleGetAllSupplies() {
    console.log('=== Пример 3: Автоматическое получение всех поставок ===');
    
    try {
      const options: AutoPaginationOptions = {
        maxPages: 5, // максимум 5 страниц
        maxItems: 1000, // максимум 1000 элементов
        delayBetweenPages: 200, // задержка 200мс между страницами
        onPageComplete: (page, data) => {
          console.log(`📄 Страница ${page} завершена, получено ${data.length} поставок`);
        },
        onComplete: (allData, totalPages) => {
          console.log(`🎉 Все поставки получены: ${allData.length} элементов за ${totalPages} страниц`);
        },
        onError: (error, page) => {
          console.error(`❌ Ошибка на странице ${page}:`, error.message);
        }
      };

      const allSupplies = await this.client.getAllSupplies(options);

      console.log('✅ Все поставки получены:', {
        totalCount: allSupplies.length,
        firstSupply: allSupplies[0],
        lastSupply: allSupplies[allSupplies.length - 1]
      });

      return allSupplies;
    } catch (error) {
      console.error('❌ Ошибка получения всех поставок:', error);
      throw error;
    }
  }

  /**
   * Пример 4: Получение коэффициентов с трансформацией данных
   */
  async exampleGetCoefficientsEnhanced() {
    console.log('=== Пример 4: Получение коэффициентов с трансформацией ===');
    
    try {
      const warehouseIds = [117501, 117502];
      const dateFrom = '2024-01-01';
      const dateTo = '2024-01-31';

      const options: DataExtractionOptions = {
        dataPath: 'data',
        validateFunction: (data) => Array.isArray(data),
        transformFunction: (data) => data.map((coeff: any) => ({
          ...coeff,
          // Трансформация типов данных
          warehouseID: parseInt(coeff.warehouseID),
          coefficient: parseFloat(coeff.coefficient),
          allowUnload: Boolean(coeff.allowUnload),
          date: new Date(coeff.date),
          // Добавляем вычисляемые поля
          isAvailable: coeff.coefficient >= 0 && coeff.allowUnload,
          coefficientCategory: coeff.coefficient > 1 ? 'high' : coeff.coefficient > 0.5 ? 'medium' : 'low'
        }))
      };

      const result = await this.client.getCoefficientsEnhanced(
        warehouseIds,
        dateFrom,
        dateTo,
        false, // isSortingCenter
        options
      );

      console.log('✅ Коэффициенты получены:', {
        count: result.data.length,
        availableSlots: result.data.filter(c => c.isAvailable).length,
        highCoefficientSlots: result.data.filter(c => c.coefficientCategory === 'high').length,
        metadata: result.metadata
      });

      return result;
    } catch (error) {
      console.error('❌ Ошибка получения коэффициентов:', error);
      throw error;
    }
  }

  /**
   * Пример 5: Получение складов с валидацией
   */
  async exampleGetWarehousesEnhanced() {
    console.log('=== Пример 5: Получение складов с валидацией ===');
    
    try {
      const options: DataExtractionOptions = {
        dataPath: 'data',
        validateFunction: (data) => {
          // Валидация: проверяем что это массив и каждый элемент имеет обязательные поля
          return Array.isArray(data) && data.every(warehouse => 
            warehouse.id && warehouse.name
          );
        },
        transformFunction: (data) => data.map((warehouse: any) => ({
          id: parseInt(warehouse.id),
          name: warehouse.name.trim(),
          address: warehouse.address?.trim() || '',
          city: warehouse.city?.trim() || '',
          region: warehouse.region?.trim() || '',
          country: warehouse.country?.trim() || 'Russia',
          // Добавляем вычисляемые поля
          fullAddress: [warehouse.address, warehouse.city, warehouse.region, 'Russia']
            .filter(Boolean)
            .join(', ')
        }))
      };

      const result = await this.client.getWarehousesEnhanced(options);

      console.log('✅ Склады получены:', {
        count: result.data.length,
        cities: [...new Set(result.data.map(w => w.city))],
        regions: [...new Set(result.data.map(w => w.region))],
        metadata: result.metadata
      });

      return result;
    } catch (error) {
      console.error('❌ Ошибка получения складов:', error);
      throw error;
    }
  }

  /**
   * Пример 6: Создание поставки с обработкой ошибок
   */
  async exampleCreateSupplyEnhanced() {
    console.log('=== Пример 6: Создание поставки ===');
    
    try {
      const supplyData = {
        name: `Тестовая поставка ${new Date().toISOString()}`,
        warehouseId: 117501,
        boxTypeId: 1,
        supplyDate: new Date().toISOString().split('T')[0]
      };

      const options: DataExtractionOptions = {
        dataPath: 'data',
        validateFunction: (data) => {
          // Валидация: проверяем что поставка создана успешно
          return data && data.id && data.name;
        },
        transformFunction: (data) => ({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          supplyDate: data.supplyDate ? new Date(data.supplyDate) : null
        })
      };

      const result = await this.client.createSupplyEnhanced(supplyData, options);

      console.log('✅ Поставка создана:', {
        id: result.data.id,
        name: result.data.name,
        status: result.data.status,
        metadata: result.metadata
      });

      return result;
    } catch (error) {
      console.error('❌ Ошибка создания поставки:', error);
      throw error;
    }
  }

  /**
   * Пример 7: Получение статистики с обработкой различных форматов
   */
  async exampleGetSuppliesStatsEnhanced() {
    console.log('=== Пример 7: Получение статистики ===');
    
    try {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-01-31';

      const options: DataExtractionOptions = {
        dataPath: 'data',
        validateFunction: (data) => {
          // Валидация: проверяем структуру статистики
          return data && typeof data === 'object' && 
                 (data.totalSupplies !== undefined || data.suppliesByStatus !== undefined);
        },
        transformFunction: (data) => ({
          ...data,
          // Трансформация дат
          period: {
            from: new Date(dateFrom),
            to: new Date(dateTo)
          },
          // Добавляем вычисляемые поля
          averageSuppliesPerDay: data.totalSupplies ? 
            Math.round(data.totalSupplies / 31) : 0,
          successRate: data.totalSupplies && data.completedSupplies ? 
            Math.round((data.completedSupplies / data.totalSupplies) * 100) : 0
        })
      };

      const result = await this.client.getSuppliesStatsEnhanced(dateFrom, dateTo, options);

      console.log('✅ Статистика получена:', {
        totalSupplies: result.data.totalSupplies,
        averagePerDay: result.data.averageSuppliesPerDay,
        successRate: result.data.successRate,
        metadata: result.metadata
      });

      return result;
    } catch (error) {
      console.error('❌ Ошибка получения статистики:', error);
      throw error;
    }
  }

  /**
   * Пример 8: Комплексный пример с обработкой ошибок и retry
   */
  async exampleComplexWorkflow() {
    console.log('=== Пример 8: Комплексный workflow ===');
    
    try {
      // 1. Получаем склады
      console.log('1. Получение складов...');
      const warehousesResult = await this.client.getWarehousesEnhanced({
        validateFunction: (data) => Array.isArray(data) && data.length > 0
      });

      if (warehousesResult.data.length === 0) {
        throw new Error('Склады не найдены');
      }

      // 2. Получаем коэффициенты для первых 3 складов
      console.log('2. Получение коэффициентов...');
      const warehouseIds = warehousesResult.data.slice(0, 3).map(w => w.id);
      const coefficientsResult = await this.client.getCoefficientsEnhanced(
        warehouseIds,
        '2024-01-01',
        '2024-01-31',
        false,
        {
          validateFunction: (data) => Array.isArray(data),
          transformFunction: (data) => data.filter(c => c.allowUnload && c.coefficient >= 0)
        }
      );

      // 3. Получаем поставки с пагинацией
      console.log('3. Получение поставок...');
      const suppliesResult = await this.client.getSuppliesWithPagination({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      // 4. Создаем сводный отчет
      const report = {
        warehouses: {
          total: warehousesResult.data.length,
          available: warehouseIds.length
        },
        coefficients: {
          total: coefficientsResult.data.length,
          available: coefficientsResult.data.filter(c => c.allowUnload).length
        },
        supplies: {
          total: suppliesResult.data.length,
          hasMore: suppliesResult.hasMore
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTime: Date.now()
        }
      };

      console.log('✅ Комплексный workflow завершен:', report);

      return {
        warehouses: warehousesResult,
        coefficients: coefficientsResult,
        supplies: suppliesResult,
        report
      };

    } catch (error) {
      console.error('❌ Ошибка в комплексном workflow:', error);
      throw error;
    }
  }

  /**
   * Запуск всех примеров
   */
  async runAllExamples() {
    console.log('🚀 Запуск всех примеров использования улучшенного API клиента...\n');

    const examples = [
      () => this.exampleGetSuppliesEnhanced(),
      () => this.exampleGetSuppliesWithPagination(),
      () => this.exampleGetCoefficientsEnhanced(),
      () => this.exampleGetWarehousesEnhanced(),
      () => this.exampleCreateSupplyEnhanced(),
      () => this.exampleGetSuppliesStatsEnhanced(),
      () => this.exampleComplexWorkflow()
    ];

    const results = [];

    for (let i = 0; i < examples.length; i++) {
      try {
        console.log(`\n--- Запуск примера ${i + 1}/${examples.length} ---`);
        const result = await examples[i]();
        results.push({ success: true, result });
        console.log(`✅ Пример ${i + 1} завершен успешно`);
      } catch (error) {
        console.error(`❌ Пример ${i + 1} завершен с ошибкой:`, error.message);
        results.push({ success: false, error: error.message });
      }

      // Небольшая задержка между примерами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Итоговый отчет:');
    console.log(`✅ Успешно: ${results.filter(r => r.success).length}`);
    console.log(`❌ С ошибками: ${results.filter(r => !r.success).length}`);

    return results;
  }
}

// Экспорт для использования
export default WBClientUsageExamples;
