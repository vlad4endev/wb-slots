import { TelegramSettingsService, TelegramSettings } from './telegram-settings.service';
import { Request as ExpressRequest } from 'express';
interface AuthenticatedRequest extends ExpressRequest {
    user: {
        sub: string;
        email: string;
    };
}
export declare class TelegramSettingsController {
    private telegramSettingsService;
    constructor(telegramSettingsService: TelegramSettingsService);
    getSettings(req: AuthenticatedRequest): Promise<{
        success: boolean;
        data: {
            settings: TelegramSettings | null;
        };
    }>;
    updateSettings(req: AuthenticatedRequest, settings: Partial<TelegramSettings>): Promise<{
        success: boolean;
        data: {
            message: string;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data?: undefined;
    }>;
    registerUser(req: AuthenticatedRequest, body: {
        chatId: number;
        username?: string;
        firstName?: string;
        lastName?: string;
    }): Promise<{
        success: boolean;
        error: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            message: string;
            chatId: number;
        };
        error?: undefined;
    }>;
    unregisterUser(req: AuthenticatedRequest): Promise<{
        success: boolean;
        data: {
            message: string;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data?: undefined;
    }>;
    getStats(req: AuthenticatedRequest): Promise<{
        success: boolean;
        data: {
            stats: {
                totalUsers: number;
                activeUsers: number;
                inactiveUsers: number;
            };
        };
    }>;
    getAllUsers(req: AuthenticatedRequest): Promise<{
        success: boolean;
        data: {
            users: {
                userId: string;
                chatId: number;
                username?: string;
                firstName?: string;
                lastName?: string;
                enabled: boolean;
                createdAt: Date;
            }[];
        };
    }>;
}
export {};
