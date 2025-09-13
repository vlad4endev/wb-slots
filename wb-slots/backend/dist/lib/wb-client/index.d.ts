import { WBSuppliesClient } from './supplies-client';
import { TokenCategory } from '@prisma/client';
export declare class WBClientFactory {
    static createClient(category: TokenCategory, token: string): WBSuppliesClient;
    static createSuppliesClient(token: string): WBSuppliesClient;
}
export * from './types';
export * from './base-client';
export * from './supplies-client';
