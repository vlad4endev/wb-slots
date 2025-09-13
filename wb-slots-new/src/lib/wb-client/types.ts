// WB API Base URLs
export const WB_API_BASE_URLS = {
  SUPPLIES: 'https://supplies-api.wildberries.ru',
  MARKETPLACE: 'https://marketplace-api.wildberries.ru',
  STATISTICS: 'https://statistics-api.wildberries.ru',
  CONTENT: 'https://content-api.wildberries.ru',
  PROMOTION: 'https://promotion-api.wildberries.ru',
  ANALYTICS: 'https://analytics-api.wildberries.ru',
  FINANCE: 'https://finance-api.wildberries.ru',
} as const;

// Token categories mapping
export const TOKEN_CATEGORY_TO_BASE_URL = {
  STATISTICS: WB_API_BASE_URLS.STATISTICS,
  SUPPLIES: WB_API_BASE_URLS.SUPPLIES,
  MARKETPLACE: WB_API_BASE_URLS.MARKETPLACE,
  CONTENT: WB_API_BASE_URLS.CONTENT,
  PROMOTION: WB_API_BASE_URLS.PROMOTION,
  ANALYTICS: WB_API_BASE_URLS.ANALYTICS,
  FINANCE: WB_API_BASE_URLS.FINANCE,
} as const;

// Common WB API response structure
export interface WBAPIResponse<T = any> {
  data: T;
  error: boolean;
  errorText: string;
  additionalErrors: any[];
}

// Supplies API types
export interface WBCoefficient {
  date: string;
  coefficient: number;
  warehouseID: number;
  warehouseName: string;
  allowUnload: boolean;
  boxTypeName: string;
  boxTypeID: number;
  storageCoef: string;
  deliveryCoef: string;
  deliveryBaseLiter: string;
  deliveryAdditionalLiter: string;
  storageBaseLiter: string;
  storageAdditionalLiter: string | null;
  isSortingCenter: boolean;
}

export interface WBWarehouse {
  id: number;
  name: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}

export interface WBBoxType {
  id: number;
  name: string;
  description?: string;
}

export interface WBSupply {
  id: string;
  name: string;
  status: string;
  warehouseId: number;
  boxTypeId: number;
  supplyDate?: string;
  factDate?: string;
  createdAt: string;
  updatedAt: string;
  goods?: WBGood[];
}

export interface WBGood {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface WBAcceptanceOptions {
  warehouseId: number;
  boxTypeId: number;
  available: boolean;
  reason?: string;
}

// Marketplace API types (FBS)
export interface FBSSupply {
  id: string;
  name: string;
  status: string;
  warehouseId: number;
  createdAt: string;
  updatedAt: string;
}

export interface FBSLabel {
  id: string;
  supplyId: string;
  labelUrl: string;
  createdAt: string;
}

// Error types
export interface WBAPIError {
  code: string;
  message: string;
  details?: any;
}

export class WBClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WBClientError';
  }
}

// Request options
export interface WBRequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// Rate limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}
