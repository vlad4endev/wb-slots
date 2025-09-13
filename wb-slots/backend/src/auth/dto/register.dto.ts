import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email пользователя' })
  @IsEmail({}, { message: 'Некорректный email адрес' })
  email!: string;

  @ApiProperty({ 
    example: '+79001234567', 
    description: 'Номер телефона (опционально)',
    required: false 
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Некорректный номер телефона' })
  phone?: string;

  @ApiProperty({ example: 'password123', description: 'Пароль (минимум 6 символов)' })
  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  password!: string;

  @ApiProperty({ example: 'Иван Иванов', description: 'Имя пользователя' })
  @IsString()
  @MinLength(2, { message: 'Имя должно содержать минимум 2 символа' })
  name!: string;
}
