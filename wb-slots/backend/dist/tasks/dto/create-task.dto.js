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
exports.CreateTaskDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateTaskDto {
}
exports.CreateTaskDto = CreateTaskDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Поиск слотов на завтра', description: 'Название задачи' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTaskDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Автоматический поиск слотов на склад Подольск',
        description: 'Описание задачи',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTaskDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0 9 * * *', description: 'Cron расписание' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTaskDto.prototype, "schedule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: {
            warehouseIds: ['123', '456'],
            boxTypeIds: ['1', '2'],
            coefficientMin: 0,
            coefficientMax: 20,
            dateFrom: '2024-01-01',
            dateTo: '2024-01-31'
        },
        description: 'Фильтры поиска'
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateTaskDto.prototype, "filters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Активна ли задача', default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTaskDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'Включено ли автобронирование', default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTaskDto.prototype, "autoBook", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'WBS123456789',
        description: 'ID поставки для автобронирования',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTaskDto.prototype, "autoBookSupplyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'WBS123456789',
        description: 'ID выбранной поставки для автобронирования',
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTaskDto.prototype, "chosenSupplyId", void 0);
//# sourceMappingURL=create-task.dto.js.map