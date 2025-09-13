import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    example: 'user@example.com', 
    description: 'Email пользователя (если не указан телефон)',
    required: false 
  })
  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email адрес' })
  email?: string;

  @ApiProperty({ 
    example: '+79001234567', 
    description: 'Номер телефона (если не указан email)',
    required: false 
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'password123', description: 'Пароль' })
  @IsString()
  password!: string;
}
