// Types for slot search functionality

export interface SlotSearchFilters {
  warehouseIds: number[];
  boxTypeIds: number[];
  coefficientMin: number;
  coefficientMax: number;
  dateFrom: string;
  dateTo: string;
  isSortingCenter?: boolean;
  updateInterval?: number;
}

export interface FoundSlot {
  warehouseId: number;
  warehouseName: string;
  date: string;
  timeSlot: string;
  coefficient: number;
  available: boolean;
  boxTypes: number[];
  boxTypeName: string;
  isSortingCenter: boolean;
  storageCoef: string;
  deliveryCoef: string;
}

export interface SlotSearchResult {
  success: boolean;
  data: {
    foundSlots: FoundSlot[];
    totalSearches: number;
    searchTime: number;
    filters: SlotSearchFilters;
    timestamp: string;
    updateInterval: number;
  };
  message: string;
  error?: string;
}

export interface SlotSearchStats {
  totalSearches: number;
  successfulSearches: number;
  failedSearches: number;
  averageSearchTime: number;
  totalFoundSlots: number;
  lastSearchTime: string;
}

export interface WarehouseInfo {
  id: number;
  name: string;
  city?: string;
  region?: string;
  isActive: boolean;
}

export interface BoxTypeInfo {
  id: number;
  name: string;
  description?: string;
}

// API Response types
export interface SlotSearchApiResponse {
  success: boolean;
  data: {
    foundSlots: FoundSlot[];
    totalSearches: number;
    searchTime: number;
    filters: SlotSearchFilters;
    timestamp: string;
    updateInterval: number;
  };
  message: string;
  error?: string;
  details?: string;
}

// Error types
export interface SlotSearchError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Log types
export interface SlotSearchLog {
  id: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context?: string;
  meta?: {
    userId?: string;
    taskId?: string;
    runId?: string;
    foundSlotsCount?: number;
    searchTime?: number;
    filters?: SlotSearchFilters;
    error?: string;
  };
  timestamp: string;
}
