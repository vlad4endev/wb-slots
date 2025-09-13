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
exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tasks_service_1 = require("./tasks.service");
const create_task_dto_1 = require("./dto/create-task.dto");
const update_task_dto_1 = require("./dto/update-task.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let TasksController = class TasksController {
    constructor(tasksService) {
        this.tasksService = tasksService;
    }
    async create(req, createTaskDto) {
        return this.tasksService.create(req.user.sub, createTaskDto);
    }
    async findAll(req) {
        return this.tasksService.findAll(req.user.sub);
    }
    async searchSlots(req, warehouseIds, boxTypeIds, coefficientMin, coefficientMax, dateFrom, dateTo, isSortingCenter, updateInterval) {
        return this.tasksService.searchSlots(req.user.sub, {
            warehouseIds: warehouseIds ? warehouseIds.split(',').map(id => parseInt(id.trim())) : [],
            boxTypeIds: boxTypeIds ? boxTypeIds.split(',').map(id => parseInt(id.trim())) : [2, 5],
            coefficientMin: coefficientMin ? parseFloat(coefficientMin) : 0,
            coefficientMax: coefficientMax ? parseFloat(coefficientMax) : 20,
            dateFrom: dateFrom || new Date().toISOString(),
            dateTo: dateTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isSortingCenter: isSortingCenter === 'true',
            updateInterval: updateInterval ? parseInt(updateInterval) : 30,
        });
    }
    async getStats(req) {
        return this.tasksService.getTaskStats(req.user.sub);
    }
    async findOne(id, req) {
        return this.tasksService.findOne(id, req.user.sub);
    }
    async update(id, req, updateTaskDto) {
        return this.tasksService.update(id, req.user.sub, updateTaskDto);
    }
    async remove(id, req) {
        return this.tasksService.remove(id, req.user.sub);
    }
    async runTask(id, req) {
        return this.tasksService.runTask(id, req.user.sub);
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Создание новой задачи' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Задача создана' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_task_dto_1.CreateTaskDto]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Получение всех задач пользователя' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Список задач' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('search-slots'),
    (0, swagger_1.ApiOperation)({ summary: 'Поиск слотов с фильтрацией' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Найденные слоты' }),
    (0, swagger_1.ApiQuery)({ name: 'warehouseIds', required: false, description: 'ID складов через запятую' }),
    (0, swagger_1.ApiQuery)({ name: 'boxTypeIds', required: false, description: 'ID типов коробов через запятую' }),
    (0, swagger_1.ApiQuery)({ name: 'coefficientMin', required: false, description: 'Минимальный коэффициент' }),
    (0, swagger_1.ApiQuery)({ name: 'coefficientMax', required: false, description: 'Максимальный коэффициент' }),
    (0, swagger_1.ApiQuery)({ name: 'dateFrom', required: false, description: 'Дата начала (ISO string)' }),
    (0, swagger_1.ApiQuery)({ name: 'dateTo', required: false, description: 'Дата окончания (ISO string)' }),
    (0, swagger_1.ApiQuery)({ name: 'isSortingCenter', required: false, description: 'Сортировочный центр' }),
    (0, swagger_1.ApiQuery)({ name: 'updateInterval', required: false, description: 'Интервал обновления в секундах' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('warehouseIds')),
    __param(2, (0, common_1.Query)('boxTypeIds')),
    __param(3, (0, common_1.Query)('coefficientMin')),
    __param(4, (0, common_1.Query)('coefficientMax')),
    __param(5, (0, common_1.Query)('dateFrom')),
    __param(6, (0, common_1.Query)('dateTo')),
    __param(7, (0, common_1.Query)('isSortingCenter')),
    __param(8, (0, common_1.Query)('updateInterval')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "searchSlots", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Получение статистики задач пользователя' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Статистика задач' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Получение задачи по ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Данные задачи' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Задача не найдена' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Обновление задачи' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Задача обновлена' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Задача не найдена' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, update_task_dto_1.UpdateTaskDto]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Удаление задачи' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Задача удалена' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Задача не найдена' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/run'),
    (0, swagger_1.ApiOperation)({ summary: 'Запуск задачи' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Задача запущена' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Задача не найдена' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "runTask", null);
exports.TasksController = TasksController = __decorate([
    (0, swagger_1.ApiTags)('Задачи'),
    (0, common_1.Controller)('tasks'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [tasks_service_1.TasksService])
], TasksController);
//# sourceMappingURL=tasks.controller.js.map