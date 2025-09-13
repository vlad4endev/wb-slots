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
exports.SuppliesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const supplies_service_1 = require("./supplies.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let SuppliesController = class SuppliesController {
    constructor(suppliesService) {
        this.suppliesService = suppliesService;
    }
    async getSupplies(req, limit, offset) {
        console.log('🔍 SuppliesController: req.user =', req.user);
        console.log('🔍 SuppliesController: req.user.sub =', req.user?.sub);
        console.log('🔍 SuppliesController: req.user.userId =', req.user?.userId);
        const userId = req.user?.sub || req.user?.userId;
        if (!userId) {
            throw new Error('User ID not found in request');
        }
        return this.suppliesService.getSupplies(userId, {
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0,
        });
    }
};
exports.SuppliesController = SuppliesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Получение списка поставок пользователя' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Список поставок' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Количество поставок (по умолчанию 50)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Смещение для пагинации (по умолчанию 0)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], SuppliesController.prototype, "getSupplies", null);
exports.SuppliesController = SuppliesController = __decorate([
    (0, swagger_1.ApiTags)('Поставки'),
    (0, common_1.Controller)('supplies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [supplies_service_1.SuppliesService])
], SuppliesController);
//# sourceMappingURL=supplies.controller.js.map