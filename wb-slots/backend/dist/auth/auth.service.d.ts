import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    private configService;
    constructor(usersService: UsersService, jwtService: JwtService, configService: ConfigService);
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
    validateUser(email: string, phone: string, password: string): Promise<any>;
    getProfile(userId: string): Promise<{
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
