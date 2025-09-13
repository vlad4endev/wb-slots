import { Request as ExpressRequest } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
interface AuthenticatedRequest extends ExpressRequest {
    user: {
        sub: string;
        email: string;
    };
}
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    create(req: AuthenticatedRequest, createTaskDto: CreateTaskDto): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        enabled: boolean;
        filters: import("@prisma/client/runtime/library").JsonValue;
        autoBook: boolean;
        autoBookSupplyId: string | null;
        chosenSupplyId: string | null;
        taskNumber: number;
        status: import(".prisma/client").$Enums.TaskStatus;
        scheduleCron: string | null;
        retryPolicy: import("@prisma/client/runtime/library").JsonValue;
        priority: number;
    }>;
    findAll(req: AuthenticatedRequest): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        enabled: boolean;
        filters: import("@prisma/client/runtime/library").JsonValue;
        autoBook: boolean;
        autoBookSupplyId: string | null;
        chosenSupplyId: string | null;
        taskNumber: number;
        status: import(".prisma/client").$Enums.TaskStatus;
        scheduleCron: string | null;
        retryPolicy: import("@prisma/client/runtime/library").JsonValue;
        priority: number;
    }[]>;
    searchSlots(req: AuthenticatedRequest, warehouseIds?: string, boxTypeIds?: string, coefficientMin?: string, coefficientMax?: string, dateFrom?: string, dateTo?: string, isSortingCenter?: string, updateInterval?: string): Promise<import("./tasks.service").SlotSearchResult>;
    getStats(req: AuthenticatedRequest): Promise<{
        totalTasks: number;
        activeTasks: number;
        completedRuns: number;
        failedRuns: number;
    }>;
    findOne(id: string, req: AuthenticatedRequest): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        enabled: boolean;
        filters: import("@prisma/client/runtime/library").JsonValue;
        autoBook: boolean;
        autoBookSupplyId: string | null;
        chosenSupplyId: string | null;
        taskNumber: number;
        status: import(".prisma/client").$Enums.TaskStatus;
        scheduleCron: string | null;
        retryPolicy: import("@prisma/client/runtime/library").JsonValue;
        priority: number;
    }>;
    update(id: string, req: AuthenticatedRequest, updateTaskDto: UpdateTaskDto): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        enabled: boolean;
        filters: import("@prisma/client/runtime/library").JsonValue;
        autoBook: boolean;
        autoBookSupplyId: string | null;
        chosenSupplyId: string | null;
        taskNumber: number;
        status: import(".prisma/client").$Enums.TaskStatus;
        scheduleCron: string | null;
        retryPolicy: import("@prisma/client/runtime/library").JsonValue;
        priority: number;
    }>;
    remove(id: string, req: AuthenticatedRequest): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        enabled: boolean;
        filters: import("@prisma/client/runtime/library").JsonValue;
        autoBook: boolean;
        autoBookSupplyId: string | null;
        chosenSupplyId: string | null;
        taskNumber: number;
        status: import(".prisma/client").$Enums.TaskStatus;
        scheduleCron: string | null;
        retryPolicy: import("@prisma/client/runtime/library").JsonValue;
        priority: number;
    }>;
    runTask(id: string, req: AuthenticatedRequest): Promise<{
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
}
export {};
