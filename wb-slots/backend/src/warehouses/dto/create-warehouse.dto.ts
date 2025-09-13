import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWarehouseDto {
  @ApiProperty({ example: 123456, description: 'ID склада в системе WB' })
  @IsNumber()
  warehouseId!: number;

  @ApiProperty({ example: 'Подольск', description: 'Название склада' })
  @IsString()
  warehouseName!: string;

  @ApiProperty({ example: true, description: 'Активен ли склад для поиска', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ example: true, description: 'Разрешены ли коробки', default: true })
  @IsOptional()
  @IsBoolean()
  boxAllowed?: boolean;

  @ApiProperty({ example: true, description: 'Разрешены ли монопаллеты', default: true })
  @IsOptional()
  @IsBoolean()
  monopalletAllowed?: boolean;

  @ApiProperty({ example: true, description: 'Разрешен ли суперсейф', default: true })
  @IsOptional()
  @IsBoolean()
  supersafeAllowed?: boolean;
}
