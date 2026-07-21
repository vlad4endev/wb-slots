import type { WBSuppliesClient } from '@/lib/wb-client';
import type { WBCoefficient } from '@/lib/wb-client/types';

/**
 * Тип найденного слота
 */
export interface FoundSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  available: boolean;
  allowUnload: boolean;
  boxTypes: number[];
  supplyId?: string;
}

/**
 * Результат проверки условий поиска
 */
export interface SearchConditionsResult {
  /** Все слоты, найденные в результате поиска */
  allSlots: FoundSlot[];
  /** Слоты, полностью соответствующие критериям (коэффициенты И склады) */
  matchingSlots: FoundSlot[];
  /** Есть ли слоты с подходящими коэффициентами */
  hasSuitableCoefficients: boolean;
  /** Есть ли слоты с подходящим статусом складов (allowUnload) */
  hasSuitableWarehouses: boolean;
  /** Нужно ли продолжать поиск (оба условия НЕ выполнены) */
  shouldContinueSearch: boolean;
}

/**
 * Executor для выполнения поиска слотов через WB API
 * Отвечает только за выполнение поиска и фильтрацию результатов
 */
export class SlotSearchExecutor {
  /**
   * Выполнить поиск слотов с проверкой условий остановки
   */
  async searchSlotsWithConditions(
    client: WBSuppliesClient,
    config: {
      warehouseIds: number[];
      boxTypeIds: number[];
      dateFrom: string;
      dateTo: string;
      coefficientMin: number;
      coefficientMax: number;
    }
  ): Promise<SearchConditionsResult> {
    const searchResult = await client.searchAvailableSlots(
      config.warehouseIds,
      config.boxTypeIds,
      config.dateFrom,
      config.dateTo,
      config.coefficientMin,
      true
    );

    // Преобразуем все слоты в формат FoundSlot
    const allSlots: FoundSlot[] = searchResult.map((slot) => ({
      warehouseId: slot.warehouseID,
      warehouseName: slot.warehouseName ?? `Склад ${slot.warehouseID}`,
      date: slot.date,
      timeSlot: '09:00-18:00',
      coefficient: slot.coefficient ?? 0,
      available: slot.allowUnload,
      allowUnload: slot.allowUnload,
      boxTypes: [slot.boxTypeID],
    }));

    // Фильтруем слоты по коэффициентам (в диапазоне coefficientMin - coefficientMax)
    const slotsWithSuitableCoefficients = allSlots.filter(
      (slot) =>
        slot.coefficient >= config.coefficientMin &&
        slot.coefficient <= config.coefficientMax
    );

    // Фильтруем слоты по статусу склада (allowUnload = true)
    const slotsWithSuitableWarehouses = allSlots.filter(
      (slot) => slot.allowUnload === true
    );

    // Слоты, соответствующие ОБОИМ критериям
    const matchingSlots = allSlots.filter(
      (slot) =>
        slot.coefficient >= config.coefficientMin &&
        slot.coefficient <= config.coefficientMax &&
        slot.allowUnload === true
    );

    // Определяем, выполнены ли условия
    const hasSuitableCoefficients = slotsWithSuitableCoefficients.length > 0;
    const hasSuitableWarehouses = slotsWithSuitableWarehouses.length > 0;

    // Поиск продолжается только если НЕТ подходящих коэффициентов И НЕТ подходящих складов
    const shouldContinueSearch = !hasSuitableCoefficients && !hasSuitableWarehouses;

    return {
      allSlots,
      matchingSlots,
      hasSuitableCoefficients,
      hasSuitableWarehouses,
      shouldContinueSearch,
    };
  }

  /**
   * Выполнить поиск слотов (обратная совместимость)
   * @deprecated Используйте searchSlotsWithConditions для получения детальной информации
   */
  async searchSlots(
    client: WBSuppliesClient,
    config: {
      warehouseIds: number[];
      boxTypeIds: number[];
      dateFrom: string;
      dateTo: string;
      coefficientMin: number;
      coefficientMax: number;
    }
  ): Promise<FoundSlot[]> {
    const result = await this.searchSlotsWithConditions(client, config);
    return result.matchingSlots;
  }
}

