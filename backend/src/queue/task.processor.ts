import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProxmoxService } from '../proxmox/proxmox.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Polls a Proxmox UPID to completion and mirrors status into the Task row.
 * Invoked directly (in-process) and by the BullMQ worker (worker.ts) for durability across API restarts.
 */
@Injectable()
export class TaskProcessor {
  private log = new Logger(TaskProcessor.name);
  constructor(private prisma: PrismaService, private pve: ProxmoxService, private tasks: TasksService, private notifications: NotificationsService) {}
  async pollUpid(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task?.upid || !task.clusterId || !task.node) return;
    const cluster = await this.prisma.cluster.findUnique({ where: { id: task.clusterId } });
    if (!cluster) { await this.tasks.update(taskId, { status: 'FAILED', progress: 100, error: 'Cluster removed' }); return; }
    await this.tasks.update(taskId, { status: 'RUNNING', progress: 10 });
    try {
      const final = await this.pve.pollTask(cluster, task.node, task.upid, async () => { await this.tasks.update(taskId, { progress: 50 }); });
      let logText: string | undefined;
      try { const lines = await this.pve.taskLog(cluster, task.node, task.upid); logText = (lines as any[]).map((l) => l.t).join('\n').slice(-8000); } catch { /* log optional */ }
      const ok = !final.exitstatus || final.exitstatus === 'OK';
      await this.tasks.update(taskId, { status: ok ? 'SUCCESS' : 'FAILED', progress: 100, log: logText, error: ok ? undefined : final.exitstatus });
      // Sync VM status after lifecycle tasks
      if (task.vmId) {
        const vm = await this.prisma.vm.findUnique({ where: { id: task.vmId } });
        if (vm && ok) {
          try {
            const live: any = await this.pve.vmStatus(cluster, vm.node, vm.type === 'LXC' ? 'lxc' : 'qemu', vm.vmid);
            await this.prisma.vm.update({ where: { id: vm.id }, data: { status: live.status === 'running' ? 'RUNNING' : 'STOPPED' } });
          } catch { /* VM may have been destroyed */ }
        }
      }
      if (!ok && task.userId) await this.notifications.create(task.userId, 'TASK_FAILED', `Task ${task.action} failed`, final.exitstatus, true).catch(() => undefined);
    } catch (e) {
      this.log.warn(`poll ${taskId}: ${(e as Error).message}`);
      await this.tasks.update(taskId, { status: 'FAILED', progress: 100, error: (e as Error).message });
    }
  }
}
