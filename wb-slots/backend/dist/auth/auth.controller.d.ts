import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
interface AuthenticatedRequest extends ExpressRequest {
    user: {
        sub: string;
        email: string;
    };
}
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        user: {
            id: string;
            email: string;
            phone: string | null;
            name: string | null;
            role: import(".prisma/client").$Enums.UserRole;
        };
        token: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        user: {
            id: string;
            email: string;
            phone: string | null;
            name: string | null;
            role: import(".prisma/client").$Enums.UserRole;
        };
        token: string;
    }>;
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
}
export {};
