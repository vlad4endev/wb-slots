import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from '@prisma/client';
import { AppLoggerService } from '../lib/logger.service';
export interface SlotSearchParams {
    warehouseIds: number[];
    boxTypeIds: number[];
    coefficientMin: number;
    coefficientMax: number;
    dateFrom: string;
    dateTo: string;
    isSortingCenter?: boolean;
    updateInterval?: number;
}
export interface SlotSearchResult {
    success: boolean;
    foundSlots: any[];
    totalSearches: number;
    searchTime: number;
    filters: SlotSearchParams;
    error?: string;
    timestamp: string;
}
export declare class TasksService {
    private prisma;
    private appLogger;
    private readonly logger;
    constructor(prisma: PrismaService, appLogger: AppLoggerService);
    create(userId: string, createTaskDto: CreateTaskDto): Promise<Task>;
    findAll(userId: string): Promise<Task[]>;
    findOne(id: string, userId: string): Promise<Task>;
    update(id: string, userId: string, updateTaskDto: UpdateTaskDto): Promise<Task>;
    remove(id: string, userId: string): Promise<Task>;
    runTask(id: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        foundSlots: number | null;
        userId: string;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        status: import(".prisma/client").$Enums.RunStatus;
        startedAt: Date;
        finishedAt: Date | null;
        taskId: string;
    }>;
    getTaskStats(userId: string): Promise<{
        totalTasks: number;
        activeTasks: number;
        completedRuns: number;
        failedRuns: number;
    }>;
    searchSlots(userId: string, params: SlotSearchParams): Promise<SlotSearchResult>;
}
