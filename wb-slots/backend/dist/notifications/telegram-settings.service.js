"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramSettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TelegramSettingsService = class TelegramSettingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSettings(userId) {
        try {
            const channel = await this.prisma.notificationChannel.findFirst({
                where: {
                    userId,
                    type: 'TELEGRAM',
                },
            });
            if (!channel) {
                return null;
            }
            const config = channel.config;
            return {
                chatId: config.chatId,
                username: config.username,
                firstName: config.firstName,
                lastName: config.lastName,
                enabled: channel.enabled,
                notificationTypes: config.notificationTypes || [],
                testMode: config.testMode || false,
                quietHours: config.quietHours || {
                    enabled: false,
                    start: '22:00',
                    end: '08:00',
                },
                language: config.language || 'ru',
                timezone: config.timezone || 'Europe/Moscow',
            };
        }
        catch (error) {
            console.error('Error getting Telegram settings:', error);
            return null;
        }
    }
    async saveSettings(userId, settings) {
        try {
            const existingChannel = await this.prisma.notificationChannel.findFirst({
                where: {
                    userId,
                    type: 'TELEGRAM',
                },
            });
            const config = {
                chatId: settings.chatId,
                username: settings.username,
                firstName: settings.firstName,
                lastName: settings.lastName,
                notificationTypes: settings.notificationTypes || [],
                testMode: settings.testMode || false,
                quietHours: settings.quietHours || {
                    enabled: false,
                    start: '22:00',
                    end: '08:00',
                },
                language: settings.language || 'ru',
                timezone: settings.timezone || 'Europe/Moscow',
            };
            if (existingChannel) {
                await this.prisma.notificationChannel.update({
                    where: { id: existingChannel.id },
                    data: {
                        config,
                        enabled: settings.enabled !== undefined ? settings.enabled : existingChannel.enabled,
                    },
                });
            }
            else {
                await this.prisma.notificationChannel.create({
                    data: {
                        userId,
                        type: 'TELEGRAM',
                        config,
                        enabled: settings.enabled !== undefined ? settings.enabled : true,
                    },
                });
            }
            return true;
        }
        catch (error) {
            console.error('Error saving Telegram settings:', error);
            return false;
        }
    }
    async updateRegistration(userId, chatId, username, firstName, lastName) {
        try {
            const settings = await this.getSettings(userId);
            const updatedSettings = {
                ...settings,
                chatId,
                username,
                firstName,
                lastName,
                enabled: true,
            };
            return await this.saveSettings(userId, updatedSettings);
        }
        catch (error) {
            console.error('Error updating Telegram registration:', error);
            return false;
        }
    }
    async disableNotifications(userId) {
        try {
            const existingChannel = await this.prisma.notificationChannel.findFirst({
                where: {
                    userId,
                    type: 'TELEGRAM',
                },
            });
            if (existingChannel) {
                await this.prisma.notificationChannel.update({
                    where: { id: existingChannel.id },
                    data: { enabled: false },
                });
            }
            return true;
        }
        catch (error) {
            console.error('Error disabling Telegram notifications:', error);
            return false;
        }
    }
    async getStats() {
        try {
            const totalUsers = await this.prisma.notificationChannel.count({
                where: { type: 'TELEGRAM' },
            });
            const activeUsers = await this.prisma.notificationChannel.count({
                where: {
                    type: 'TELEGRAM',
                    enabled: true,
                },
            });
            const inactiveUsers = totalUsers - activeUsers;
            return {
                totalUsers,
                activeUsers,
                inactiveUsers,
            };
        }
        catch (error) {
            console.error('Error getting Telegram stats:', error);
            return {
                totalUsers: 0,
                activeUsers: 0,
                inactiveUsers: 0,
            };
        }
    }
    async getAllUsers() {
        try {
            const channels = await this.prisma.notificationChannel.findMany({
                where: { type: 'TELEGRAM' },
                select: {
                    userId: true,
                    config: true,
                    enabled: true,
                    createdAt: true,
                },
            });
            return channels.map(channel => {
                const config = channel.config;
                return {
                    userId: channel.userId,
                    chatId: config.chatId,
                    username: config.username,
                    firstName: config.firstName,
                    lastName: config.lastName,
                    enabled: channel.enabled,
                    createdAt: channel.createdAt,
                };
            });
        }
        catch (error) {
            console.error('Error getting all Telegram users:', error);
            return [];
        }
    }
};
exports.TelegramSettingsService = TelegramSettingsService;
exports.TelegramSettingsService = TelegramSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TelegramSettingsService);
//# sourceMappingURL=telegram-settings.service.js.map