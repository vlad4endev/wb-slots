import { WBSlotSearchAdapter } from './services/unified/wb-slot-search-adapter';
import { TelegramService } from './services/telegram-service';

// Singleton instance для TelegramService
let telegramServiceInstance: TelegramService | null = null;

function getTelegramService(): TelegramService {
  if (!telegramServiceInstance) {
    telegramServiceInstance = new TelegramService();
  }
  return telegramServiceInstance;
}

export interface SlotSearchConfig {
  userId: string;
  taskId: string;
  runId?: string;
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  stopOnFirstFound: boolean;
  isSortingCenter: boolean;
  maxSearchCycles?: number;
  searchDelay?: number;
  maxExecutionTime?: number;
  autoBook?: boolean;
  autoBookSupplyId?: string;
  taskName?: string;
}

export interface FoundSlot {
  id: string;
  warehouseId: number;
  boxTypeId: number;
  date: string;
  coefficient: number;
  available: boolean;
  warehouseName?: string;
  boxTypeName?: string;
}

export interface SearchResult {
  foundSlots: FoundSlot[];
  totalChecked: number;
  searchTime: number;
  errors: string[];
  stoppedEarly: boolean;
}

/**
 * WBSlotSearch - обертка над новым UnifiedSlotSearchService для обратной совместимости
 */
export class WBSlotSearch {
  private adapter: WBSlotSearchAdapter;
  private config: SlotSearchConfig;

  constructor(config: SlotSearchConfig) {
    this.config = config;
    this.adapter = new WBSlotSearchAdapter(config);
  }

  /**
   * Основной метод поиска слотов с непрерывным поиском до нахождения нужного слота
   */
  async searchSlots(): Promise<SearchResult> {
    // Используем новый адаптер для поиска слотов
    const result = await this.adapter.searchSlots();
      
      return {
      foundSlots: result.foundSlots,
      totalChecked: result.totalChecked,
      searchTime: result.searchTime,
      errors: result.errors,
      stoppedEarly: result.stoppedEarly
    };
  }
}