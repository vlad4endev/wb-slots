import { LoggerService } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export interface LogEntry {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    context?: string;
    userId?: string;
    taskId?: string;
    runId?: string;
    meta?: any;
    timestamp?: Date;
}
export declare class AppLoggerService implements LoggerService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    log(message: any, context?: string): void;
    error(message: any, trace?: string, context?: string): void;
    warn(message: any, context?: string): void;
    debug(message: any, context?: string): void;
    verbose(message: any, context?: string): void;
    logSlotSearch(level: 'INFO' | 'WARN' | 'ERROR', message: string, data: {
        userId: string;
        taskId?: string;
        runId?: string;
        foundSlotsCount: number;
        searchTime: number;
        filters: any;
        error?: string;
    }): Promise<void>;
    logEmptyResults(userId: string, filters: any, searchTime: number, taskId?: string, runId?: string): Promise<void>;
    logSearchError(userId: string, error: string, filters: any, searchTime: number, taskId?: string, runId?: string): Promise<void>;
    logSearchSuccess(userId: string, foundSlotsCount: number, searchTime: number, filters: any, taskId?: string, runId?: string): Promise<void>;
    private saveToDatabase;
    getUserSearchLogs(userId: string, limit?: number, offset?: number): Promise<unknown>;
    getErrorLogs(limit?: number, offset?: number): Promise<unknown>;
}
