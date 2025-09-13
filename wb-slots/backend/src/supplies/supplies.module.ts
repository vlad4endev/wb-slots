import { Module } from '@nestjs/common';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { AppLoggerService } from '../lib/logger.service';

@Module({
  controllers: [SuppliesController],
  providers: [SuppliesService, AppLoggerService],
  exports: [SuppliesService],
})
export class SuppliesModule {}
