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
var TasksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const wb_client_1 = require("../lib/wb-client");
const encryption_1 = require("../lib/encryption");
const logger_service_1 = require("../lib/logger.service");
let TasksService = TasksService_1 = class TasksService {
    constructor(prisma, appLogger) {
        this.prisma = prisma;
        this.appLogger = appLogger;
        this.logger = new common_1.Logger(TasksService_1.name);
    }
    async create(userId, createTaskDto) {
        return this.prisma.task.create({
            data: {
                userId,
                name: createTaskDto.name,
                description: createTaskDto.description,
                scheduleCron: createTaskDto.schedule,
                filters: createTaskDto.filters,
                enabled: createTaskDto.isActive ?? true,
                autoBook: createTaskDto.autoBook ?? false,
                autoBookSupplyId: createTaskDto.autoBookSupplyId,
                chosenSupplyId: createTaskDto.chosenSupplyId,
                retryPolicy: { maxRetries: 3, backoffMs: 5000 },
            },
            include: {
                runs: true,
            },
        });
    }
    async findAll(userId) {
        return this.prisma.task.findMany({
            where: { userId },
            include: {
                runs: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id, userId) {
        const task = await this.prisma.task.findUnique({
            where: { id },
            include: {
                runs: {
                    include: {
                        logs: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!task) {
            throw new common_1.NotFoundException('Задача не найдена');
        }
        if (task.userId !== userId) {
            throw new common_1.ForbiddenException('Доступ запрещен');
        }
        return task;
    }
    async update(id, userId, updateTaskDto) {
        const task = await this.prisma.task.findUnique({
            where: { id },
        });
        if (!task) {
            throw new common_1.NotFoundException('Задача не найдена');
        }
        if (task.userId !== userId) {
            throw new common_1.ForbiddenException('Доступ запрещен');
        }
        return this.prisma.task.update({
            where: { id },
            data: updateTaskDto,
            include: {
                runs: true,
            },
        });
    }
    async remove(id, userId) {
        const task = await this.prisma.task.findUnique({
            where: { id },
        });
        if (!task) {
            throw new common_1.NotFoundException('Задача не найдена');
        }
        if (task.userId !== userId) {
            throw new common_1.ForbiddenException('Доступ запрещен');
        }
        return this.prisma.task.delete({
            where: { id },
        });
    }
    async runTask(id, userId) {
        const task = await this.findOne(id, userId);
        const run = await this.prisma.run.create({
            data: {
                task: {
                    connect: { id: id }
                },
                user: {
                    connect: { id: userId }
                },
                status: client_1.RunStatus.QUEUED,
                startedAt: new Date(),
            },
        });
        return run;
    }
    async getTaskStats(userId) {
        const totalTasks = await this.prisma.task.count({
            where: { userId },
        });
        const activeTasks = await this.prisma.task.count({
            where: {
                userId,
            },
        });
        const completedRuns = await this.prisma.run.count({
            where: {
                task: { userId },
                status: client_1.RunStatus.SUCCESS,
            },
        });
        const failedRuns = await this.prisma.run.count({
            where: {
                task: { userId },
                status: client_1.RunStatus.FAILED,
            },
        });
        return {
            totalTasks,
            activeTasks,
            completedRuns,
            failedRuns,
        };
    }
    async searchSlots(userId, params) {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();
        this.logger.log(`Starting slot search for user ${userId}`, {
            params,
            timestamp,
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
                this.logger.error(error, { userId, timestamp });
                return {
                    success: false,
                    foundSlots: [],
                    totalSearches: 0,
                    searchTime: Date.now() - startTime,
                    filters: params,
                    error,
                    timestamp,
                };
            }
            const decryptedToken = (0, encryption_1.decrypt)(suppliesToken.tokenEncrypted);
            const wbClient = wb_client_1.WBClientFactory.createSuppliesClient(decryptedToken);
            const searchResult = await wbClient.searchAvailableSlots(params.warehouseIds, params.boxTypeIds, params.dateFrom, params.dateTo, params.coefficientMin, true);
            const filteredSlots = searchResult.filter((slot) => {
                const coefficient = slot.coefficient || 0;
                if (coefficient < params.coefficientMin || coefficient > params.coefficientMax) {
                    return false;
                }
                if (params.warehouseIds.length > 0 && !params.warehouseIds.includes(slot.warehouseID)) {
                    return false;
                }
                if (params.boxTypeIds.length > 0 && !params.boxTypeIds.includes(slot.boxTypeID)) {
                    return false;
                }
                const slotDate = new Date(slot.date);
                const fromDate = new Date(params.dateFrom);
                const toDate = new Date(params.dateTo);
                if (slotDate < fromDate || slotDate > toDate) {
                    return false;
                }
                if (params.isSortingCenter !== undefined && slot.isSortingCenter !== params.isSortingCenter) {
                    return false;
                }
                return true;
            });
            const searchTime = Date.now() - startTime;
            const foundSlotsCount = filteredSlots.length;
            if (foundSlotsCount === 0) {
                await this.appLogger.logEmptyResults(userId, params, searchTime);
            }
            else {
                await this.appLogger.logSearchSuccess(userId, foundSlotsCount, searchTime, params);
            }
            return {
                success: true,
                foundSlots: filteredSlots.map(slot => ({
                    warehouseId: slot.warehouseID,
                    warehouseName: slot.warehouseName,
                    date: slot.date,
                    timeSlot: '09:00-18:00',
                    coefficient: slot.coefficient,
                    available: slot.allowUnload,
                    boxTypes: [slot.boxTypeID],
                    boxTypeName: slot.boxTypeName,
                    isSortingCenter: slot.isSortingCenter,
                    storageCoef: slot.storageCoef,
                    deliveryCoef: slot.deliveryCoef,
                })),
                totalSearches: 1,
                searchTime,
                filters: params,
                timestamp,
            };
        }
        catch (error) {
            const searchTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.appLogger.logSearchError(userId, errorMessage, params, searchTime);
            return {
                success: false,
                foundSlots: [],
                totalSearches: 0,
                searchTime,
                filters: params,
                error: errorMessage,
                timestamp,
            };
        }
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = TasksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.AppLoggerService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map