import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ProxmoxService } from '../proxmox/proxmox.service';
import { Roles } from '../common/decorators';
import { VmsService } from '../vms/vms.service';
@ApiTags('admin') @ApiBearerAuth() @Roles('SUPER_ADMIN', 'ADMIN') @Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService, private pve: ProxmoxService, private vms: VmsService) {}
  /** Admin dashboard aggregates + live cluster resource usage. */
  @Get('dashboard') async dashboard() {
    const [users, vmsRunning, vmsStopped, vmsTotal, recentTasks, clusters] = await Promise.all([
      this.prisma.user.count(), this.prisma.vm.count({ where: { status: 'RUNNING', deletedAt: null } }),
      this.prisma.vm.count({ where: { status: 'STOPPED', deletedAt: null } }), this.prisma.vm.count({ where: { deletedAt: null } }),
      this.prisma.task.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.cluster.findMany({ where: { enabled: true } }),
    ]);
    const clusterUsage: unknown[] = [];
    for (const c of clusters) {
      try { const nodes: any[] = await this.pve.nodes(c); clusterUsage.push({ cluster: c.name, nodes: nodes.map((n) => ({ node: n.node, status: n.status, cpu: n.cpu, maxcpu: n.maxcpu, mem: n.mem, maxmem: n.maxmem, disk: n.disk, maxdisk: n.maxdisk })) }); }
      catch (e) { clusterUsage.push({ cluster: c.name, error: (e as Error).message }); }
    }
    const alerts = recentTasks.filter((t) => t.status === 'FAILED').map((t) => ({ type: 'task_failed', taskId: t.id, action: t.action, error: t.error, at: t.createdAt }));
    return { totals: { users, vmsTotal, vmsRunning, vmsStopped }, clusterUsage, recentTasks, alerts };
  }
  @Post('purge-expired-vms') purge() { return this.vms.purgeExpired(); }
}
