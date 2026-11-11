import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ProxmoxModule } from './proxmox/proxmox.module';
import { MailModule } from './mail/mail.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClustersModule } from './clusters/clusters.module';
import { VmsModule } from './vms/vms.module';
import { TasksModule } from './tasks/tasks.module';
import { PlansModule } from './plans/plans.module';
import { IpamModule } from './ipam/ipam.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TicketsModule } from './tickets/tickets.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SettingsModule } from './settings/settings.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), // global 120 req/min/IP; auth endpoints stricter
    PrismaModule, ProxmoxModule, MailModule, QueueModule,
    AuthModule, UsersModule, ClustersModule, VmsModule, TasksModule, PlansModule, IpamModule,
    AuditModule, NotificationsModule, TicketsModule, ApiKeysModule, SettingsModule, AdminModule,
  ],
  providers: [
    JwtService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
