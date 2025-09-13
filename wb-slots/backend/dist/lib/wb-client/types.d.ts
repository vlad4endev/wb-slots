export declare const WB_API_BASE_URLS: {
    readonly SUPPLIES: "https://supplies-api.wildberries.ru";
    readonly MARKETPLACE: "https://marketplace-api.wildberries.ru";
    readonly STATISTICS: "https://statistics-api.wildberries.ru";
    readonly CONTENT: "https://content-api.wildberries.ru";
    readonly PROMOTION: "https://promotion-api.wildberries.ru";
    readonly ANALYTICS: "https://analytics-api.wildberries.ru";
    readonly FINANCE: "https://finance-api.wildberries.ru";
};
export declare const TOKEN_CATEGORY_TO_BASE_URL: {
    readonly STATISTICS: "https://statistics-api.wildberries.ru";
    readonly SUPPLIES: "https://supplies-api.wildberries.ru";
    readonly MARKETPLACE: "https://marketplace-api.wildberries.ru";
    readonly CONTENT: "https://content-api.wildberries.ru";
    readonly PROMOTION: "https://promotion-api.wildberries.ru";
    readonly ANALYTICS: "https://analytics-api.wildberries.ru";
    readonly FINANCE: "https://finance-api.wildberries.ru";
};
export interface WBAPIResponse<T = any> {
    data: T;
    error: boolean;
    errorText: string;
    additionalErrors: any[];
}
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
export interface WBAPIError {
    code: string;
    message: string;
    details?: any;
}
export declare class WBClientError extends Error {
    statusCode: number;
    code?: string | undefined;
    details?: any | undefined;
    constructor(message: string, statusCode: number, code?: string | undefined, details?: any | undefined);
}
export interface WBRequestOptions {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}
