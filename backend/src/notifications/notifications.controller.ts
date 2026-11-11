import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, AuthUser } from '../common/decorators';
@ApiTags('notifications') @ApiBearerAuth() @Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post(':id/read') read(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.markRead(u.id, id); }
  @Post('read-all') all(@CurrentUser() u: AuthUser) { return this.svc.markAllRead(u.id); }
}
