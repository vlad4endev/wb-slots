import { IsString, IsBoolean, IsOptional, IsObject, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ example: 'Поиск слотов на завтра', description: 'Название задачи' })
  @IsString()
  name!: string;

  @ApiProperty({ 
    example: 'Автоматический поиск слотов на склад Подольск', 
    description: 'Описание задачи',
    required: false 
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '0 9 * * *', description: 'Cron расписание' })
  @IsString()
  schedule!: string;

  @ApiProperty({ 
    example: { 
      warehouseIds: ['123', '456'], 
      boxTypeIds: ['1', '2'], 
      coefficientMin: 0, 
      coefficientMax: 20,
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31'
    }, 
    description: 'Фильтры поиска' 
  })
  @IsObject()
  filters: any;

  @ApiProperty({ example: true, description: 'Активна ли задача', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: false, description: 'Включено ли автобронирование', default: false })
  @IsOptional()
  @IsBoolean()
  autoBook?: boolean;

  @ApiProperty({ 
    example: 'WBS123456789', 
    description: 'ID поставки для автобронирования',
    required: false 
  })
  @IsOptional()
  @IsString()
  autoBookSupplyId?: string;

  @ApiProperty({ 
    example: 'WBS123456789', 
    description: 'ID выбранной поставки для автобронирования',
    required: false 
  })
  @IsOptional()
  @IsString()
  chosenSupplyId?: string;
}
