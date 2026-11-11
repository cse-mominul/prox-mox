import { Injectable, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '../common/types';

export interface TaskEvent { taskId: string; status: TaskStatus; progress: number; log?: string | null; error?: string | null; }
/** Task rows mirror Proxmox UPIDs. Progress events fan out to SSE subscribers. */
@Injectable()
export class TasksService {
  readonly events = new Subject<TaskEvent>();
  constructor(private prisma: PrismaService) {}
  create(userId: string | undefined, action: string, opts: { vmId?: string; clusterId?: string; node?: string; upid?: string } = {}) {
    return this.prisma.task.create({ data: { userId: userId || null, action, vmId: opts.vmId, clusterId: opts.clusterId, node: opts.node, upid: opts.upid, status: 'QUEUED', progress: 0 } });
  }
  async update(id: string, patch: Partial<{ status: TaskStatus; progress: number; log: string; error: string; upid: string }>) {
    const t = await this.prisma.task.update({ where: { id }, data: { ...patch, finishedAt: patch.status === 'SUCCESS' || patch.status === 'FAILED' ? new Date() : undefined } });
    this.events.next({ taskId: id, status: t.status, progress: t.progress, log: t.log, error: t.error });
    return t;
  }
  async get(id: string, user: { id: string; role: string }) {
    const t = await this.prisma.task.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Task not found');
    if (user.role === 'USER' && t.userId !== user.id) throw new NotFoundException('Task not found');
    return t;
  }
  async list(user: { id: string; role: string }, q: { page?: number; limit?: number; vmId?: string }) {
    const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Number(q.limit) || 20);
    const where: Record<string, unknown> = {};
    if (user.role === 'USER') where.userId = user.id;
    if (q.vmId) where.vmId = q.vmId;
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.task.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }
}
