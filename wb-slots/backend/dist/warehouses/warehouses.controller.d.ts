import { Request as ExpressRequest } from 'express';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
interface AuthenticatedRequest extends ExpressRequest {
    user: {
        sub: string;
        email: string;
    };
}
export declare class WarehousesController {
    private readonly warehousesService;
    constructor(warehousesService: WarehousesService);
    create(req: AuthenticatedRequest, createWarehouseDto: CreateWarehouseDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        warehouseId: number;
        warehouseName: string;
        enabled: boolean;
        boxAllowed: boolean;
        monopalletAllowed: boolean;
        supersafeAllowed: boolean;
    }>;
    findAll(req: AuthenticatedRequest): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        warehouseId: number;
        warehouseName: string;
        enabled: boolean;
        boxAllowed: boolean;
        monopalletAllowed: boolean;
        supersafeAllowed: boolean;
    }[]>;
    findOne(id: string, req: AuthenticatedRequest): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        warehouseId: number;
        warehouseName: string;
        enabled: boolean;
        boxAllowed: boolean;
        monopalletAllowed: boolean;
        supersafeAllowed: boolean;
    }>;
    update(id: string, req: AuthenticatedRequest, updateWarehouseDto: UpdateWarehouseDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        warehouseId: number;
        warehouseName: string;
        enabled: boolean;
        boxAllowed: boolean;
        monopalletAllowed: boolean;
        supersafeAllowed: boolean;
    }>;
    remove(id: string, req: AuthenticatedRequest): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        warehouseId: number;
        warehouseName: string;
        enabled: boolean;
        boxAllowed: boolean;
        monopalletAllowed: boolean;
        supersafeAllowed: boolean;
    }>;
    toggleActive(id: string, req: AuthenticatedRequest): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        warehouseId: number;
        warehouseName: string;
        enabled: boolean;
        boxAllowed: boolean;
        monopalletAllowed: boolean;
        supersafeAllowed: boolean;
    }>;
}
export {};
