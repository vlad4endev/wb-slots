import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
 import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    sub: string;
    email: string;
  };
}

@ApiTags('Задачи')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Создание новой задачи' })
  @ApiResponse({ status: 201, description: 'Задача создана' })
  async create(@Request() req: AuthenticatedRequest, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(req.user.sub, createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получение всех задач пользователя' })
  @ApiResponse({ status: 200, description: 'Список задач' })
  async findAll(@Request() req: AuthenticatedRequest) {
    return this.tasksService.findAll(req.user.sub);
  }

  @Get('search-slots')
  @ApiOperation({ summary: 'Поиск слотов с фильтрацией' })
  @ApiResponse({ status: 200, description: 'Найденные слоты' })
  @ApiQuery({ name: 'warehouseIds', required: false, description: 'ID складов через запятую' })
  @ApiQuery({ name: 'boxTypeIds', required: false, description: 'ID типов коробов через запятую' })
  @ApiQuery({ name: 'coefficientMin', required: false, description: 'Минимальный коэффициент' })
  @ApiQuery({ name: 'coefficientMax', required: false, description: 'Максимальный коэффициент' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Дата начала (ISO string)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Дата окончания (ISO string)' })
  @ApiQuery({ name: 'isSortingCenter', required: false, description: 'Сортировочный центр' })
  @ApiQuery({ name: 'updateInterval', required: false, description: 'Интервал обновления в секундах' })
  async searchSlots(
    @Request() req: AuthenticatedRequest,
    @Query('warehouseIds') warehouseIds?: string,
    @Query('boxTypeIds') boxTypeIds?: string,
    @Query('coefficientMin') coefficientMin?: string,
    @Query('coefficientMax') coefficientMax?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('isSortingCenter') isSortingCenter?: string,
    @Query('updateInterval') updateInterval?: string,
  ) {
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

  @Get('stats')
  @ApiOperation({ summary: 'Получение статистики задач пользователя' })
  @ApiResponse({ status: 200, description: 'Статистика задач' })
  async getStats(@Request() req: AuthenticatedRequest) {
    return this.tasksService.getTaskStats(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение задачи по ID' })
  @ApiResponse({ status: 200, description: 'Данные задачи' })
  @ApiResponse({ status: 404, description: 'Задача не найдена' })
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.tasksService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновление задачи' })
  @ApiResponse({ status: 200, description: 'Задача обновлена' })
  @ApiResponse({ status: 404, description: 'Задача не найдена' })
  async update(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, req.user.sub, updateTaskDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление задачи' })
  @ApiResponse({ status: 200, description: 'Задача удалена' })
  @ApiResponse({ status: 404, description: 'Задача не найдена' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.tasksService.remove(id, req.user.sub);
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Запуск задачи' })
  @ApiResponse({ status: 201, description: 'Задача запущена' })
  @ApiResponse({ status: 404, description: 'Задача не найдена' })
  async runTask(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.tasksService.runTask(id, req.user.sub);
  }
}
