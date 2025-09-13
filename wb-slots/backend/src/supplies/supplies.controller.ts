import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SuppliesService } from './supplies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    sub: string;
    userId: string;
    email: string;
  };
}

@ApiTags('Поставки')
@Controller('supplies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Get()
  @ApiOperation({ summary: 'Получение списка поставок пользователя' })
  @ApiResponse({ status: 200, description: 'Список поставок' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество поставок (по умолчанию 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Смещение для пагинации (по умолчанию 0)' })
  async getSupplies(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    console.log('🔍 SuppliesController: req.user =', req.user);
    console.log('🔍 SuppliesController: req.user.sub =', req.user?.sub);
    console.log('🔍 SuppliesController: req.user.userId =', req.user?.userId);
    
    // Поддерживаем как sub, так и userId для совместимости
    const userId = req.user?.sub || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    
    return this.suppliesService.getSupplies(userId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }
}
