import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { AppLoggerService } from '../lib/logger.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, AppLoggerService],
  exports: [TasksService],
})
export class TasksModule {}
