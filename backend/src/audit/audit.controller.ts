import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { Roles } from '../common/decorators';
@ApiTags('audit') @ApiBearerAuth() @Roles('SUPER_ADMIN', 'ADMIN') @Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}
  @Get() list(@Query() q: Record<string, string>) { return this.audit.list(q as never); }
  @Get('export.csv') async csv(@Query() q: Record<string, string>, @Res() res: Response) {
    const { data } = await this.audit.list({ ...q, limit: 100 } as never);
    const rows = [['id', 'actor', 'action', 'entity', 'entityId', 'ip', 'createdAt'], ...data.map((r: any) => [r.id, r.actor?.email || '', r.action, r.entity || '', r.entityId || '', r.ip || '', r.createdAt?.toISOString?.() || ''])];
    res.setHeader('Content-Type', 'text/csv'); res.send(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'));
  }
}
