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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramSettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const telegram_settings_service_1 = require("./telegram-settings.service");
let TelegramSettingsController = class TelegramSettingsController {
    constructor(telegramSettingsService) {
        this.telegramSettingsService = telegramSettingsService;
    }
    async getSettings(req) {
        const settings = await this.telegramSettingsService.getSettings(req.user.sub);
        return {
            success: true,
            data: {
                settings,
            },
        };
    }
    async updateSettings(req, settings) {
        const success = await this.telegramSettingsService.saveSettings(req.user.sub, settings);
        if (success) {
            return {
                success: true,
                data: {
                    message: 'Settings updated successfully',
                },
            };
        }
        else {
            return {
                success: false,
                error: 'Failed to update settings',
            };
        }
    }
    async registerUser(req, body) {
        const { chatId, username, firstName, lastName } = body;
        if (!chatId) {
            return {
                success: false,
                error: 'Chat ID is required',
            };
        }
        const success = await this.telegramSettingsService.updateRegistration(req.user.sub, chatId, username, firstName, lastName);
        if (success) {
            return {
                success: true,
                data: {
                    message: 'User registered for Telegram notifications',
                    chatId,
                },
            };
        }
        else {
            return {
                success: false,
                error: 'Failed to register user',
            };
        }
    }
    async unregisterUser(req) {
        const success = await this.telegramSettingsService.disableNotifications(req.user.sub);
        if (success) {
            return {
                success: true,
                data: {
                    message: 'User unregistered from Telegram notifications',
                },
            };
        }
        else {
            return {
                success: false,
                error: 'Failed to unregister user',
            };
        }
    }
    async getStats(req) {
        const stats = await this.telegramSettingsService.getStats();
        return {
            success: true,
            data: {
                stats,
            },
        };
    }
    async getAllUsers(req) {
        const users = await this.telegramSettingsService.getAllUsers();
        return {
            success: true,
            data: {
                users,
            },
        };
    }
};
exports.TelegramSettingsController = TelegramSettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get Telegram notification settings for current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Settings retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelegramSettingsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Put)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update Telegram notification settings for current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Settings updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid settings data' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TelegramSettingsController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Register user for Telegram notifications' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User registered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid registration data' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TelegramSettingsController.prototype, "registerUser", null);
__decorate([
    (0, common_1.Delete)('unregister'),
    (0, swagger_1.ApiOperation)({ summary: 'Unregister user from Telegram notifications' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User unregistered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelegramSettingsController.prototype, "unregisterUser", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Telegram notification statistics' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Statistics retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelegramSettingsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users with Telegram settings (admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Users retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelegramSettingsController.prototype, "getAllUsers", null);
exports.TelegramSettingsController = TelegramSettingsController = __decorate([
    (0, swagger_1.ApiTags)('Telegram Settings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('notifications/telegram/settings'),
    __metadata("design:paramtypes", [telegram_settings_service_1.TelegramSettingsService])
], TelegramSettingsController);
//# sourceMappingURL=telegram-settings.controller.js.map