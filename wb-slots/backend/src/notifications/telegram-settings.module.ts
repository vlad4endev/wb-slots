import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramSettingsService } from './telegram-settings.service';
import { TelegramSettingsController } from './telegram-settings.controller';

@Module({
  imports: [PrismaModule],
  providers: [TelegramSettingsService],
  controllers: [TelegramSettingsController],
  exports: [TelegramSettingsService],
})
export class TelegramSettingsModule {}
