import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
export interface TelegramSettings {
    chatId?: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
    notificationTypes: NotificationType[];
    testMode: boolean;
    quietHours: {
        enabled: boolean;
        start: string;
        end: string;
    };
    language: string;
    timezone: string;
}
export declare class TelegramSettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    getSettings(userId: string): Promise<TelegramSettings | null>;
    saveSettings(userId: string, settings: Partial<TelegramSettings>): Promise<boolean>;
    updateRegistration(userId: string, chatId: number, username?: string, firstName?: string, lastName?: string): Promise<boolean>;
    disableNotifications(userId: string): Promise<boolean>;
    getStats(): Promise<{
        totalUsers: number;
        activeUsers: number;
        inactiveUsers: number;
    }>;
    getAllUsers(): Promise<Array<{
        userId: string;
        chatId: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        enabled: boolean;
        createdAt: Date;
    }>>;
}
