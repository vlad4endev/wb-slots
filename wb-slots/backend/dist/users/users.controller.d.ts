import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request as ExpressRequest } from 'express';
interface AuthenticatedRequest extends ExpressRequest {
    user: {
        sub: string;
        email: string;
    };
}
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: AuthenticatedRequest): Promise<{
        email: string;
        phone: string | null;
        passwordHash: string;
        name: string | null;
        id: string;
        timezone: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: Date | null;
        createdAt: Date;
        updatedAt: Date;
        isProtected: boolean;
    } | null>;
    updateProfile(req: AuthenticatedRequest, updateUserDto: UpdateUserDto): Promise<{
        email: string;
        phone: string | null;
        passwordHash: string;
        name: string | null;
        id: string;
        timezone: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: Date | null;
        createdAt: Date;
        updatedAt: Date;
        isProtected: boolean;
    }>;
    getUserTokens(req: AuthenticatedRequest): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        category: import(".prisma/client").$Enums.TokenCategory;
        tokenEncrypted: string;
        lastUsedAt: Date | null;
    }[]>;
    getUserWarehouses(req: AuthenticatedRequest): Promise<{
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
    findOne(id: string): Promise<{
        email: string;
        phone: string | null;
        passwordHash: string;
        name: string | null;
        id: string;
        timezone: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: Date | null;
        createdAt: Date;
        updatedAt: Date;
        isProtected: boolean;
    } | null>;
    remove(id: string): Promise<{
        email: string;
        phone: string | null;
        passwordHash: string;
        name: string | null;
        id: string;
        timezone: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: Date | null;
        createdAt: Date;
        updatedAt: Date;
        isProtected: boolean;
    }>;
}
export {};
