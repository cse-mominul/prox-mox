import { Controller, Get, Param, Query, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, filter, map } from 'rxjs';
import { TasksService } from './tasks.service';
import { CurrentUser, AuthUser } from '../common/decorators';
@ApiTags('tasks') @ApiBearerAuth() @Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: Record<string, string>) { return this.tasks.list(u, q as never); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.tasks.get(id, u); }
  /** Real-time task progress via Server-Sent Events: GET /api/v1/tasks/stream?taskId=... (EventSource cannot set headers; frontend polls fallback + uses this with fetch streaming). */
  @Sse('stream') stream(@Query('taskId') taskId?: string): Observable<MessageEvent> {
    return this.tasks.events.pipe(filter((e) => !taskId || e.taskId === taskId), map((e) => ({ data: e })));
  }
}
