import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { SuppliesModule } from './supplies/supplies.module';
import { TelegramSettingsModule } from './notifications/telegram-settings.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppLoggerService } from './lib/logger.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TasksModule,
    WarehousesModule,
    SuppliesModule,
    TelegramSettingsModule,
  ],
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class AppModule {}
