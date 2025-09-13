import { WBClientFactory } from './wb-client';

export interface SlotSearchParams {
  warehouseIds: number[];
  dateFrom: string;
  dateTo: string;
  coefficientMin: number;
  coefficientMax: number;
  allowUnload: boolean;
  boxTypeIds: number[];
}

export interface FoundSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  available: boolean;
  boxTypes: string[];
}

export interface SlotSearchResult {
  foundSlots: FoundSlot[];
  totalChecked: number;
  searchTime: number;
  errors: string[];
}

export class WBSlotFinder {
  private suppliesClient: any;

  constructor(apiToken: string) {
    this.suppliesClient = WBClientFactory.createSuppliesClient(apiToken);
  }

  /**
   * Поиск свободных слотов по заданным параметрам
   */
  async findAvailableSlots(params: SlotSearchParams): Promise<SlotSearchResult> {
    const startTime = Date.now();
    const foundSlots: FoundSlot[] = [];
    const errors: string[] = [];
    let totalChecked = 0;

    try {
      // Получаем коэффициенты для каждого склада
      for (const warehouseId of params.warehouseIds) {
        try {
          const coefficients = await this.suppliesClient.getAcceptanceCoefficients({
            warehouseId,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          });

          totalChecked += coefficients.length;

          // Фильтруем по коэффициенту
          const filteredCoefficients = coefficients.filter((coef: any) => 
            coef.coefficient >= params.coefficientMin && 
            coef.coefficient <= params.coefficientMax
          );

          // Преобразуем в слоты
          for (const coef of filteredCoefficients) {
            if (coef.available) {
              foundSlots.push({
                warehouseId: coef.warehouseId,
                warehouseName: coef.warehouseName || `Склад ${coef.warehouseId}`,
                date: coef.date,
                timeSlot: coef.timeSlot || '09:00-18:00',
                coefficient: coef.coefficient,
                available: true,
                boxTypes: this.getBoxTypes(coef.boxTypes, params.boxTypeIds),
              });
            }
          }
        } catch (error) {
          errors.push(`Ошибка поиска на складе ${warehouseId}: ${error}`);
        }
      }

      return {
        foundSlots,
        totalChecked,
        searchTime: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      errors.push(`Общая ошибка поиска: ${error}`);
      return {
        foundSlots,
        totalChecked,
        searchTime: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Получение типов коробок из ответа API
   */
  private getBoxTypes(apiBoxTypes: any[], requestedBoxTypeIds: number[]): string[] {
    const boxTypeMap: { [key: number]: string } = {
      5: 'Box',
      6: 'Monopallet',
      7: 'Supersafe',
    };

    return requestedBoxTypeIds
      .filter(id => apiBoxTypes.some(bt => bt.id === id && bt.available))
      .map(id => boxTypeMap[id] || `Type ${id}`);
  }

  /**
   * Проверка доступности конкретного слота
   */
  async checkSlotAvailability(warehouseId: number, date: string): Promise<boolean> {
    try {
      const coefficients = await this.suppliesClient.getAcceptanceCoefficients({
        warehouseId,
        dateFrom: date,
        dateTo: date,
      });

      return coefficients.some((coef: any) => coef.available);
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return false;
    }
  }
}
