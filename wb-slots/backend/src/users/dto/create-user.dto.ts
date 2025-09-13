import { IsEmail, IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email пользователя' })
  @IsEmail()
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

  @ApiProperty({ example: 'hashedPassword', description: 'Хешированный пароль' })
  @IsString()
  passwordHash!: string;

  @ApiProperty({ example: 'Иван Иванов', description: 'Имя пользователя' })
  @IsString()
  name!: string;
}
