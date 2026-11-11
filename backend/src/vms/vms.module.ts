import { Module } from '@nestjs/common';
import { VmsService } from './vms.service';
import { VmsController } from './vms.controller';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { QueueService } from '../queue/queue.service';
import { TaskProcessor } from '../queue/task.processor';
import { NotificationsService } from '../notifications/notifications.service';
@Module({ controllers: [VmsController], providers: [VmsService, AuditService, TasksService, QueueService, TaskProcessor, NotificationsService], exports: [VmsService, TasksService, QueueService, TaskProcessor] })
export class VmsModule {}
