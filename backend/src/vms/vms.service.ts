import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
type Vm = { id: string; ownerId: string; clusterId: string; node: string; vmid: number; type: string; name: string; status: string; vcpu: number; ramMb: number; diskGb: number; storage: string; bridge: string; deletedAt: Date | null };
import { PrismaService } from '../prisma/prisma.service';
import { ProxmoxService } from '../proxmox/proxmox.service';
import { ClustersService } from '../clusters/clusters.service';
import { UsersService } from '../users/users.service';
import { TasksService } from '../tasks/tasks.service';
import { QueueService } from '../queue/queue.service';
import { TaskProcessor } from '../queue/task.processor';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateVmDto } from './dto/vms.dto';

@Injectable()
export class VmsService {
  constructor(
    private prisma: PrismaService, private pve: ProxmoxService, private clusters: ClustersService,
    private users: UsersService, private tasks: TasksService, private queue: QueueService,
    private processor: TaskProcessor, private audit: AuditService, private notifications: NotificationsService,
  ) {}
  typePath(vm: Pick<Vm, 'type'>) { return vm.type === 'LXC' ? 'lxc' : 'qemu'; }
  /** Ownership check on every VM action: USERs only own VMs; ADMIN+ any. */
  async getOwned(id: string, user: { id: string; role: string }) {
    const vm = await this.prisma.vm.findUnique({ where: { id }, include: { cluster: true } });
    if (!vm) throw new NotFoundException('VM not found');
    if (user.role === 'USER' && vm.ownerId !== user.id) throw new ForbiddenException('Not your VM');
    return vm;
  }
  private async track(userId: string, action: string, vm: Vm & { cluster: any }, upid: string | undefined) {
    const task = await this.tasks.create(userId, action, { vmId: vm.id, clusterId: vm.clusterId, node: vm.node, upid });
    if (upid) await this.queue.enqueueUpidPoll(task.id, () => this.processor.pollUpid(task.id));
    else await this.tasks.update(task.id, { status: 'SUCCESS', progress: 100 });
    return task;
  }
  async list(user: { id: string; role: string }, q: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Number(q.limit) || 20);
    const where: Record<string, unknown> = { deletedAt: null };
    if (user.role === 'USER') where.ownerId = user.id;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    if (q.status) where.status = q.status;
    const [data, total] = await Promise.all([
      this.prisma.vm.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { owner: { select: { id: true, email: true, name: true } }, plan: true } }),
      this.prisma.vm.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }
  async create(dto: CreateVmDto, user: { id: string; role: string }, ip?: string) {
    // Resolve plan defaults
    let vcpu = dto.vcpu || 1, ramMb = dto.ramMb || 1024, diskGb = dto.diskGb || 10;
    if (dto.planId) { const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: dto.planId } }); vcpu = dto.vcpu || plan.vcpu; ramMb = dto.ramMb || plan.ramMb; diskGb = dto.diskGb || plan.diskGb; }
    await this.users.assertQuota(user.role === 'USER' ? user.id : await this.vmOwnerForQuota(dto, user), { vcpu, ramMb, diskGb });
    const cluster = await this.clusters.getRaw(dto.clusterId);
    const node = dto.node || (await this.clusters.leastLoadedNode(cluster.id));
    const type = dto.type || 'QEMU';
    const vmid = Number(await this.pve.nextVmid(cluster));
    // IPAM allocation
    let ipAddress: string | undefined = dto.ip && dto.ip !== 'dhcp' ? dto.ip : undefined;
    let poolAllocId: string | undefined;
    if (dto.ipPoolId && !ipAddress) {
      const free = await this.prisma.ipAddress.findFirst({ where: { poolId: dto.ipPoolId, status: 'FREE' }, orderBy: { ip: 'asc' } });
      if (!free) throw new BadRequestException('IP pool exhausted');
      ipAddress = free.ip; poolAllocId = free.id;
    }
    const bridge = dto.bridge || 'vmbr0';
    const net0 = dto.vlan ? `virtio,bridge=${bridge},tag=${dto.vlan}` : `virtio,bridge=${bridge}`;
    let upid: string;
    if (dto.cloneFromVmid) {
      upid = await this.pve.post<string>(cluster, `/nodes/${node}/${type === 'LXC' ? 'lxc' : 'qemu'}/${dto.cloneFromVmid}/clone`, { newid: vmid, name: dto.name, full: dto.fullClone === false ? 0 : 1, target: node, storage: dto.storage });
      // Resize/apply resources after clone via config update (best-effort once task completes is handled by user resize; apply now may race — Proxmox queues config, safe to set pending)
      await this.pve.post(cluster, `/nodes/${node}/${type === 'LXC' ? 'lxc' : 'qemu'}/${vmid}/config`, { cores: vcpu, memory: ramMb }).catch(() => undefined);
    } else if (type === 'LXC') {
      upid = await this.pve.post<string>(cluster, `/nodes/${node}/lxc`, { vmid, hostname: dto.hostname || dto.name, ostemplate: dto.iso, cores: vcpu, memory: ramMb, swap: 512, rootfs: `${dto.storage || 'local-lvm'}:${diskGb}`, net0: `name=eth0,bridge=${bridge}${dto.vlan ? `,tag=${dto.vlan}` : ''}${ipAddress ? `,ip=${ipAddress}/24` : ''}`, password: dto.rootPassword, 'ssh-public-keys': dto.sshKey });
    } else {
      const data: Record<string, unknown> = { vmid, name: dto.name, cores: vcpu, memory: ramMb, net0, scsi0: `${dto.storage || 'local-lvm'}:${diskGb}`, scsihw: 'virtio-scsi-pci', boot: 'order=scsi0;ide2;net0', agent: 1 };
      if (dto.iso) { data.ide2 = `${dto.iso},media=cdrom`; }
      if (dto.cloudInit || ipAddress || dto.sshKey) {
        data.ide2 = data.ide2 && dto.iso ? data.ide2 : `${dto.storage || 'local-lvm'}:cloudinit`;
        if (ipAddress) data.ipconfig0 = `ip=${ipAddress}/24`;
        if (dto.sshKey) data.sshkeys = encodeURIComponent(dto.sshKey);
        if (dto.rootPassword) data.cipassword = dto.rootPassword;
      }
      upid = await this.pve.post<string>(cluster, `/nodes/${node}/qemu`, data);
    }
    const vm = await this.prisma.vm.create({ data: { ownerId: user.id, clusterId: cluster.id, planId: dto.planId, node, vmid, type, name: dto.name, hostname: dto.hostname, vcpu, ramMb, diskGb, storage: dto.storage || 'local-lvm', bridge, vlan: dto.vlan, ipAddress, template: dto.cloneFromVmid ? String(dto.cloneFromVmid) : dto.iso, description: dto.description, tags: dto.tags || [] } });
    if (poolAllocId) await this.prisma.ipAddress.update({ where: { id: poolAllocId }, data: { status: 'ASSIGNED', vmId: vm.id } });
    const task = await this.track(user.id, 'vm.create', { ...vm, cluster } as never, upid);
    await this.audit.log(user.id, 'vm.create', { entity: 'vm', entityId: vm.id, ip, metadata: { vmid, node } });
    await this.notifications.create(user.id, 'VM_CREATED', `VM ${vm.name} is being created`, `VMID ${vmid} on ${node}`);
    return { vm, taskId: task.id, upid };
  }
  private async vmOwnerForQuota(_dto: CreateVmDto, user: { id: string }) { return user.id; }
  async detail(id: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    let live: unknown = null; let config: unknown = null;
    try { live = await this.pve.vmStatus(vm.cluster, vm.node, this.typePath(vm), vm.vmid); } catch { /* offline cluster */ }
    try { config = await this.pve.vmConfig(vm.cluster, vm.node, this.typePath(vm), vm.vmid); } catch { /* ignore */ }
    return { vm, live, config };
  }
  async action(id: string, action: 'start'|'stop'|'shutdown'|'reboot'|'reset'|'suspend'|'resume', user: { id: string; role: string }, ip?: string) {
    const vm = await this.getOwned(id, user);
    const upid = await this.pve.post<string>(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/status/${action}`);
    const task = await this.track(user.id, `vm.${action}`, vm as never, upid);
    await this.audit.log(user.id, `vm.${action}`, { entity: 'vm', entityId: id, ip });
    return { taskId: task.id, upid };
  }
  async update(id: string, dto: { vcpu?: number; ramMb?: number; diskGb?: number; description?: string; tags?: string[]; bootOrder?: string }, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const patch: Record<string, unknown> = {};
    if (dto.vcpu) patch.cores = dto.vcpu;
    if (dto.ramMb) patch.memory = dto.ramMb;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.bootOrder) patch.boot = dto.bootOrder;
    if (Object.keys(patch).length) await this.pve.post(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/config`, patch);
    let resizeTaskId: string | undefined;
    if (dto.diskGb) {
      if (dto.diskGb < vm.diskGb) throw new BadRequestException('Disk can only be grown');
      await this.users.assertQuota(vm.ownerId, { vcpu: 0, ramMb: 0, diskGb: dto.diskGb - vm.diskGb, vms: 0 });
      const upid = await this.pve.put<string>(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/resize`, { disk: vm.type === 'LXC' ? 'rootfs' : 'scsi0', size: `${dto.diskGb}G` });
      resizeTaskId = (await this.track(user.id, 'vm.resize', vm as never, upid)).id;
    }
    const updated = await this.prisma.vm.update({ where: { id }, data: { vcpu: dto.vcpu || vm.vcpu, ramMb: dto.ramMb || vm.ramMb, diskGb: dto.diskGb || vm.diskGb, description: dto.description ?? vm.description, tags: dto.tags || vm.tags } });
    return { vm: updated, taskId: resizeTaskId };
  }
  async mountIso(id: string, iso: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    await this.pve.post(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/config`, { ide2: iso ? `${iso},media=cdrom` : 'none,media=cdrom' });
    return { message: iso ? 'ISO mounted' : 'ISO unmounted' };
  }
  async metrics(id: string, timeframe: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const tf = ['hour', 'day', 'week', 'month'].includes(timeframe) ? timeframe : 'hour';
    return this.pve.rrddata(vm.cluster, vm.node, this.typePath(vm), vm.vmid, tf);
  }
  // Snapshots
  async listSnapshots(id: string, user: { id: string; role: string }) { const vm = await this.getOwned(id, user); return this.pve.get(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/snapshot`); }
  async createSnapshot(id: string, dto: { name: string; description?: string; vmstate?: boolean }, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const { used } = await this.users.usage(vm.ownerId); const quota = await this.prisma.quota.findUnique({ where: { userId: vm.ownerId } });
    if (quota && used.snapshots >= quota.maxSnapshots) throw new BadRequestException('Snapshot quota exceeded');
    const upid = await this.pve.post<string>(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/snapshot`, { snapname: dto.name, description: dto.description, vmstate: dto.vmstate ? 1 : 0 });
    await this.prisma.snapshot.create({ data: { vmId: vm.id, name: dto.name, description: dto.description } });
    const task = await this.track(user.id, 'snapshot.create', vm as never, upid);
    return { taskId: task.id, upid };
  }
  async rollbackSnapshot(id: string, name: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const upid = await this.pve.post<string>(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/snapshot/${encodeURIComponent(name)}/rollback`);
    return { taskId: (await this.track(user.id, 'snapshot.rollback', vm as never, upid)).id, upid };
  }
  async deleteSnapshot(id: string, name: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const upid = await this.pve.del<string>(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/snapshot/${encodeURIComponent(name)}`);
    await this.prisma.snapshot.deleteMany({ where: { vmId: vm.id, name } });
    return { taskId: (await this.track(user.id, 'snapshot.delete', vm as never, upid)).id, upid };
  }
  // Backups (vzdump)
  async listBackups(id: string, user: { id: string; role: string }) { const vm = await this.getOwned(id, user); return this.prisma.backup.findMany({ where: { vmId: vm.id }, orderBy: { createdAt: 'desc' } }); }
  async createBackup(id: string, dto: { storage?: string; mode?: string }, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const storage = dto.storage || 'local';
    const upid = await this.pve.post<string>(vm.cluster, `/nodes/${vm.node}/vzdump`, { vmid: vm.vmid, storage, mode: (dto.mode || 'snapshot').toLowerCase(), remove: 0, compress: 'zstd' });
    const backup = await this.prisma.backup.create({ data: { vmId: vm.id, storage, mode: (dto.mode as never) || 'SNAPSHOT' } });
    const task = await this.track(user.id, 'backup.create', vm as never, upid);
    return { backup, taskId: task.id, upid };
  }
  async deleteBackup(id: string, backupId: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const backup = await this.prisma.backup.findFirstOrThrow({ where: { id: backupId, vmId: vm.id } });
    if (backup.volid) await this.pve.del(vm.cluster, `/nodes/${vm.node}/storage/${backup.storage}/content/${encodeURIComponent(backup.volid)}`);
    await this.prisma.backup.delete({ where: { id: backupId } });
    return { message: 'Backup deleted' };
  }
  async restoreBackup(id: string, dto: { volid: string; storage?: string }, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const path = vm.type === 'LXC' ? `/nodes/${vm.node}/lxc` : `/nodes/${vm.node}/qemu`;
    const upid = await this.pve.post<string>(vm.cluster, path, { vmid: vm.vmid, archive: dto.volid, storage: dto.storage || vm.storage, restore: 1, force: 1 });
    return { taskId: (await this.track(user.id, 'backup.restore', vm as never, upid)).id, upid };
  }
  async scheduleBackup(id: string, dto: { cron: string; storage?: string; mode?: string; retention?: number }, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    return this.prisma.backupSchedule.create({ data: { vmId: vm.id, cron: dto.cron, storage: dto.storage || 'local', mode: (dto.mode as never) || 'SNAPSHOT', retention: dto.retention || 3 } });
  }
  async listSchedules(id: string, user: { id: string; role: string }) { const vm = await this.getOwned(id, user); return this.prisma.backupSchedule.findMany({ where: { vmId: vm.id } }); }
  // Console tickets (ticket stays server-side; frontend connects to backend ws proxy path)
  async consoleTicket(id: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    if (vm.type === 'LXC') {
      const t = await this.pve.termProxy(vm.cluster, vm.node, vm.vmid);
      return { type: 'xterm', node: vm.node, vmid: vm.vmid, ...t, wsPath: `/api/v1/vms/${id}/console/ws` };
    }
    const t = await this.pve.vncProxy(vm.cluster, vm.node, 'qemu', vm.vmid);
    return { type: 'novnc', node: vm.node, vmid: vm.vmid, ...t, wsPath: `/api/v1/vms/${id}/console/ws` };
  }
  async reinstall(id: string, dto: { templateVmid?: number; iso?: string }, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    // Stop → destroy → recreate skeleton via clone/iso is destructive; require stopped flow:
    try { await this.pve.post(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/status/stop`); } catch { /* already stopped */ }
    const delUpid = await this.pve.del<string>(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}`, { purge: 1 });
    await this.processor.pollUpid((await this.track(user.id, 'vm.reinstall.destroy', vm as never, delUpid)).id);
    const create = await this.create({ clusterId: vm.clusterId, node: vm.node, type: vm.type, name: vm.name, vcpu: vm.vcpu, ramMb: vm.ramMb, diskGb: vm.diskGb, storage: vm.storage, bridge: vm.bridge, cloneFromVmid: dto.templateVmid, iso: dto.iso }, { id: vm.ownerId, role: 'ADMIN' });
    await this.prisma.vm.update({ where: { id: vm.id }, data: { deletedAt: new Date() } });
    return { message: 'Reinstall started (old VM purged, new VM created)', ...create };
  }
  async resetPassword(id: string, password: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    // QEMU: requires guest agent (qga) — set via agent exec is cluster-specific; use cloud-init cipassword + LXC password API fallback.
    if (vm.type === 'LXC') await this.pve.put(vm.cluster, `/nodes/${vm.node}/lxc/${vm.vmid}/config`, { password });
    else await this.pve.post(vm.cluster, `/nodes/${vm.node}/qemu/${vm.vmid}/config`, { cipassword: password });
    await this.audit.log(user.id, 'vm.reset_password', { entity: 'vm', entityId: id });
    return { message: 'Password reset requested (applies on reboot / via guest agent for QEMU cloud-init)' };
  }
  async softDelete(id: string, confirmName: string, purge: boolean, user: { id: string; role: string }, ip?: string) {
    const vm = await this.getOwned(id, user);
    if (confirmName !== vm.name) throw new BadRequestException('Confirmation name does not match VM name');
    try { await this.pve.post(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/status/stop`); } catch { /* already stopped */ }
    await this.prisma.vm.update({ where: { id }, data: { deletedAt: new Date(), status: 'DELETED' } });
    await this.prisma.ipAddress.updateMany({ where: { vmId: id }, data: { status: 'FREE', vmId: null } });
    await this.audit.log(user.id, 'vm.delete.soft', { entity: 'vm', entityId: id, ip, metadata: { purge } });
    await this.notifications.create(vm.ownerId, 'VM_DELETED', `VM ${vm.name} deleted`, 'Restore within retention window from admin.', true);
    return { message: `VM soft-deleted. Hard purge after ${process.env.SOFT_DELETE_RETENTION_HOURS || 24}h.`, purgeDisks: purge };
  }
  async restoreDeleted(id: string, user: { id: string; role: string }) {
    const vm = await this.prisma.vm.findUnique({ where: { id } });
    if (!vm?.deletedAt) throw new NotFoundException('Deleted VM not found');
    if (user.role === 'USER' && vm.ownerId !== user.id) throw new ForbiddenException('Not your VM');
    const hours = Number(process.env.SOFT_DELETE_RETENTION_HOURS || 24);
    if (Date.now() - vm.deletedAt.getTime() > hours * 3600_000) throw new BadRequestException('Restore window expired');
    await this.prisma.vm.update({ where: { id }, data: { deletedAt: null, status: 'STOPPED' } });
    return { message: 'VM restored (stopped). Start it when ready.' };
  }
  /** Called by scheduler/admin: hard-destroy soft-deleted VMs past retention. */
  async purgeExpired() {
    const hours = Number(process.env.SOFT_DELETE_RETENTION_HOURS || 24);
    const expired = await this.prisma.vm.findMany({ where: { deletedAt: { lt: new Date(Date.now() - hours * 3600_000) } }, include: { cluster: true } });
    for (const vm of expired) {
      try { await this.pve.del(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm as never)}/${vm.vmid}`, { purge: 1 }); } catch { /* already gone */ }
      await this.prisma.vm.delete({ where: { id: vm.id } });
    }
    return { purged: expired.length };
  }
  // Firewall (per-VM, proxied to Proxmox firewall API)
  async listFirewall(id: string, user: { id: string; role: string }) { const vm = await this.getOwned(id, user); return this.pve.get(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/firewall/rules`).catch(() => this.prisma.firewallRule.findMany({ where: { vmId: id }, orderBy: { position: 'asc' } })); }
  async addFirewall(id: string, dto: Record<string, unknown>, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    await this.pve.post(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/firewall/rules`, { action: dto.action || 'ACCEPT', type: dto.dir || 'in', enable: 1, proto: dto.proto, dport: dto.dport, source: dto.source, dest: dto.dest, comment: dto.comment }).catch(() => undefined);
    return this.prisma.firewallRule.create({ data: { vmId: vm.id, action: String(dto.action || 'ACCEPT'), dir: String(dto.dir || 'in'), proto: dto.proto as string, dport: dto.dport as string, source: dto.source as string, dest: dto.dest as string, comment: dto.comment as string } });
  }
  async deleteFirewall(id: string, ruleId: string, user: { id: string; role: string }) {
    const vm = await this.getOwned(id, user);
    const rule = await this.prisma.firewallRule.findFirstOrThrow({ where: { id: ruleId, vmId: vm.id } });
    await this.pve.del(vm.cluster, `/nodes/${vm.node}/${this.typePath(vm)}/${vm.vmid}/firewall/rules/${rule.position}`).catch(() => undefined);
    await this.prisma.firewallRule.delete({ where: { id: ruleId } });
    return { message: 'Rule deleted' };
  }
}
