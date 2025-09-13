import { PrismaService } from '../prisma/prisma.service';
import { AppLoggerService } from '../lib/logger.service';
export interface Supply {
    id: string;
    name: string;
    status: string;
    warehouseId: number;
    boxTypeId: number;
    supplyDate?: string;
    factDate?: string;
    createdAt: string;
    updatedAt: string;
    goods?: any[];
}
export interface GetSuppliesParams {
    limit: number;
    offset: number;
}
export interface GetSuppliesResult {
    success: boolean;
    supplies: Supply[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
    };
    error?: string;
}
export declare class SuppliesService {
    private prisma;
    private appLogger;
    private readonly logger;
    constructor(prisma: PrismaService, appLogger: AppLoggerService);
    getSupplies(userId: string, params: GetSuppliesParams): Promise<GetSuppliesResult>;
}
