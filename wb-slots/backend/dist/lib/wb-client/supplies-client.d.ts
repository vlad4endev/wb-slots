import { BaseWBClient } from './base-client';
import { WBCoefficient, WBWarehouse, WBSupply, WBGood, WBAcceptanceOptions } from './types';
export declare class WBSuppliesClient extends BaseWBClient {
    constructor(token: string);
    getCoefficients(warehouseIds: number[], dateFrom?: string, dateTo?: string, isSortingCenter?: boolean): Promise<WBCoefficient[]>;
    getWarehouses(): Promise<WBWarehouse[]>;
    getAcceptanceOptions(barcodes: string[], quantities: number[]): Promise<WBAcceptanceOptions[]>;
    getSupplies(limit?: number, offset?: number, statusIDs?: number[], dateFrom?: string, dateTo?: string): Promise<WBSupply[]>;
    getSupplyDetails(supplyId: string): Promise<WBSupply>;
    getSupplyGoods(supplyId: string): Promise<WBGood[]>;
    searchAvailableSlots(warehouseIds: number[], boxTypeIds: number[], dateFrom: string, dateTo: string, coefficientThreshold?: number, allowUnload?: boolean): Promise<WBCoefficient[]>;
    checkSlotAvailability(warehouseId: number, boxTypeId: number, date: string): Promise<boolean>;
}
