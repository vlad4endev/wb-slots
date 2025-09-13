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
var SuppliesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppliesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const wb_client_1 = require("../lib/wb-client");
const encryption_1 = require("../lib/encryption");
const logger_service_1 = require("../lib/logger.service");
let SuppliesService = SuppliesService_1 = class SuppliesService {
    constructor(prisma, appLogger) {
        this.prisma = prisma;
        this.appLogger = appLogger;
        this.logger = new common_1.Logger(SuppliesService_1.name);
    }
    async getSupplies(userId, params) {
        const startTime = Date.now();
        this.logger.log(`Getting supplies for user ${userId}`, {
            params,
            timestamp: new Date().toISOString(),
        });
        try {
            const suppliesToken = await this.prisma.userToken.findFirst({
                where: {
                    userId,
                    category: 'SUPPLIES',
                    isActive: true,
                },
            });
            if (!suppliesToken) {
                const error = 'No active supplies token found. Please add a SUPPLIES token in settings.';
                this.logger.error(error, { userId });
                return {
                    success: false,
                    supplies: [],
                    pagination: {
                        limit: params.limit,
                        offset: params.offset,
                        total: 0,
                        hasMore: false,
                    },
                    error,
                };
            }
            console.log('🔐 Encrypted token length:', suppliesToken.tokenEncrypted.length);
            const decryptedToken = (0, encryption_1.decrypt)(suppliesToken.tokenEncrypted);
            console.log('🔓 Decrypted token length:', decryptedToken.length);
            console.log('🔓 Decrypted token preview:', decryptedToken.substring(0, 20) + '...');
            const wbClient = wb_client_1.WBClientFactory.createSuppliesClient(decryptedToken);
            const statusIDs = [1];
            console.log('🚀 Вызываем wbClient.getSupplies с параметрами:', {
                limit: params.limit,
                offset: params.offset,
                statusIDs: statusIDs
            });
            let wbSupplies;
            try {
                wbSupplies = await wbClient.getSupplies(params.limit, params.offset, statusIDs);
                console.log('✅ WB API ответ получен:', {
                    suppliesCount: wbSupplies?.length || 0,
                    firstSupply: wbSupplies?.[0] || null
                });
            }
            catch (wbError) {
                console.error('❌ Ошибка WB API:', wbError);
                const errorMessage = wbError instanceof Error ? wbError.message : String(wbError);
                throw new Error(`WB API Error: ${errorMessage}`);
            }
            const filteredSupplies = wbSupplies;
            const supplies = filteredSupplies.map(supply => ({
                id: supply.id,
                name: supply.name || `Поставка ${supply.id}`,
                status: supply.status,
                warehouseId: supply.warehouseId,
                boxTypeId: supply.boxTypeId,
                supplyDate: supply.supplyDate,
                factDate: supply.factDate,
                createdAt: supply.createdAt,
                updatedAt: supply.updatedAt,
                goods: supply.goods || [],
            }));
            const searchTime = Date.now() - startTime;
            await this.appLogger.logSlotSearch('INFO', 'Supplies fetched successfully', {
                userId,
                foundSlotsCount: supplies.length,
                searchTime,
                filters: params,
            });
            this.logger.log(`Supplies fetched successfully`, {
                userId,
                suppliesCount: supplies.length,
                searchTime,
                params,
            });
            return {
                success: true,
                supplies,
                pagination: {
                    limit: params.limit,
                    offset: params.offset,
                    total: supplies.length,
                    hasMore: supplies.length === params.limit,
                },
            };
        }
        catch (error) {
            const searchTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.appLogger.logSearchError(userId, errorMessage, params, searchTime);
            this.logger.error(`Failed to get supplies for user ${userId}`, {
                error: errorMessage,
                params,
                searchTime,
            });
            return {
                success: false,
                supplies: [],
                pagination: {
                    limit: params.limit,
                    offset: params.offset,
                    total: 0,
                    hasMore: false,
                },
                error: errorMessage,
            };
        }
    }
};
exports.SuppliesService = SuppliesService;
exports.SuppliesService = SuppliesService = SuppliesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.AppLoggerService])
], SuppliesService);
//# sourceMappingURL=supplies.service.js.map