import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    sub: string;
    email: string;
  };
}

@ApiTags('Пользователи')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Получение профиля текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Профиль пользователя' })
  async getProfile(@Request() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.sub);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Обновление профиля текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Профиль обновлен' })
  async updateProfile(@Request() req: AuthenticatedRequest, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.sub, updateUserDto);
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Получение токенов WB API пользователя' })
  @ApiResponse({ status: 200, description: 'Список токенов' })
  async getUserTokens(@Request() req: AuthenticatedRequest) {
    return this.usersService.getUserTokens(req.user.sub);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'Получение складов пользователя' })
  @ApiResponse({ status: 200, description: 'Список складов' })
  async getUserWarehouses(@Request() req: AuthenticatedRequest) {
    return this.usersService.getUserWarehouses(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение пользователя по ID' })
  @ApiResponse({ status: 200, description: 'Данные пользователя' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь удален' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
