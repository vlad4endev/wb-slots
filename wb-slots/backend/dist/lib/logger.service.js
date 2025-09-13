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
var AppLoggerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppLoggerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AppLoggerService = AppLoggerService_1 = class AppLoggerService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(AppLoggerService_1.name);
    }
    log(message, context) {
        this.logger.log(message, context);
        this.saveToDatabase('INFO', message, context);
    }
    error(message, trace, context) {
        this.logger.error(message, trace, context);
        this.saveToDatabase('ERROR', message, context, { trace });
    }
    warn(message, context) {
        this.logger.warn(message, context);
        this.saveToDatabase('WARN', message, context);
    }
    debug(message, context) {
        this.logger.debug(message, context);
        this.saveToDatabase('DEBUG', message, context);
    }
    verbose(message, context) {
        this.logger.verbose(message, context);
        this.saveToDatabase('DEBUG', message, context);
    }
    async logSlotSearch(level, message, data) {
        const logMessage = `${message} | Found: ${data.foundSlotsCount} | Time: ${data.searchTime}ms`;
        if (level === 'ERROR') {
            this.error(logMessage, data.error, 'SlotSearch');
        }
        else if (level === 'WARN') {
            this.warn(logMessage, 'SlotSearch');
        }
        else {
            this.log(logMessage, 'SlotSearch');
        }
        await this.saveToDatabase(level, logMessage, 'SlotSearch', {
            userId: data.userId,
            taskId: data.taskId,
            runId: data.runId,
            foundSlotsCount: data.foundSlotsCount,
            searchTime: data.searchTime,
            filters: data.filters,
            error: data.error,
        });
    }
    async logEmptyResults(userId, filters, searchTime, taskId, runId) {
        await this.logSlotSearch('WARN', 'No slots found for search criteria', {
            userId,
            taskId,
            runId,
            foundSlotsCount: 0,
            searchTime,
            filters,
        });
    }
    async logSearchError(userId, error, filters, searchTime, taskId, runId) {
        await this.logSlotSearch('ERROR', 'Slot search failed', {
            userId,
            taskId,
            runId,
            foundSlotsCount: 0,
            searchTime,
            filters,
            error,
        });
    }
    async logSearchSuccess(userId, foundSlotsCount, searchTime, filters, taskId, runId) {
        await this.logSlotSearch('INFO', 'Slot search completed successfully', {
            userId,
            taskId,
            runId,
            foundSlotsCount,
            searchTime,
            filters,
        });
    }
    async saveToDatabase(level, message, context, meta) {
        try {
            await this.prisma.$executeRaw `
        INSERT INTO slot_search_logs (level, message, context, meta, created_at)
        VALUES (${level}, ${message}, ${context || 'App'}, ${JSON.stringify(meta || {})}::jsonb, ${new Date()})
      `;
        }
        catch (error) {
            console.error('Failed to save log to database:', error);
        }
    }
    async getUserSearchLogs(userId, limit = 100, offset = 0) {
        try {
            const logs = await this.prisma.$queryRaw `
        SELECT * FROM slot_search_logs 
        WHERE meta->>'userId' = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
            return logs;
        }
        catch (error) {
            console.error('Failed to get user search logs:', error);
            return [];
        }
    }
    async getErrorLogs(limit = 100, offset = 0) {
        try {
            const logs = await this.prisma.$queryRaw `
        SELECT * FROM slot_search_logs 
        WHERE level = 'ERROR'
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
            return logs;
        }
        catch (error) {
            console.error('Failed to get error logs:', error);
            return [];
        }
    }
};
exports.AppLoggerService = AppLoggerService;
exports.AppLoggerService = AppLoggerService = AppLoggerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppLoggerService);
//# sourceMappingURL=logger.service.js.map