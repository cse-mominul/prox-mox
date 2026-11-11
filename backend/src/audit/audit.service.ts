import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  async log(actorId: string | undefined, action: string, opts: { entity?: string; entityId?: string; ip?: string; userAgent?: string; metadata?: Record<string, unknown> } = {}) {
    await this.prisma.auditLog.create({ data: { actorId: actorId || null, action, entity: opts.entity, entityId: opts.entityId, ip: opts.ip, userAgent: opts.userAgent, metadata: (opts.metadata || {}) as object } }).catch(() => undefined);
  }
  async list(q: { page?: number; limit?: number; action?: string; actorId?: string }) {
    const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Number(q.limit) || 20);
    const where: Record<string, unknown> = {};
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.actorId) where.actorId = q.actorId;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, email: true, name: true } } } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }
}
