import { Request as ExpressRequest } from 'express';
import { SuppliesService } from './supplies.service';
interface AuthenticatedRequest extends ExpressRequest {
    user: {
        sub: string;
        userId: string;
        email: string;
    };
}
export declare class SuppliesController {
    private readonly suppliesService;
    constructor(suppliesService: SuppliesService);
    getSupplies(req: AuthenticatedRequest, limit?: string, offset?: string): Promise<import("./supplies.service").GetSuppliesResult>;
}
export {};
