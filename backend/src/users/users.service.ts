import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, QuotaDto } from './dto/users.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  async create(dto: CreateUserDto, actorId: string, ip?: string) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })) throw new BadRequestException('Email already exists');
    const u = await this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }), role: dto.role || 'USER', status: 'ACTIVE', emailVerifiedAt: new Date(), quota: { create: {} } }, include: { quota: true } });
    await this.audit.log(actorId, 'user.create', { entity: 'user', entityId: u.id, ip });
    return this.sanitize(u);
  }
  async list(q: { page?: number; limit?: number; search?: string; role?: string; status?: string }) {
    const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Number(q.limit) || 20);
    const where: Record<string, unknown> = {};
    if (q.search) where.OR = [{ email: { contains: q.search, mode: 'insensitive' } }, { name: { contains: q.search, mode: 'insensitive' } }];
    if (q.role) where.role = q.role; if (q.status) where.status = q.status;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { quota: true, _count: { select: { vms: true } } } }),
      this.prisma.user.count({ where }),
    ]);
    return { data: data.map((u) => this.sanitize(u)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }
  async get(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, include: { quota: true, _count: { select: { vms: true, sessions: true } } } });
    if (!u) throw new NotFoundException('User not found');
    return this.sanitize(u);
  }
  async update(id: string, dto: UpdateUserDto, actorId: string, ip?: string) {
    const u = await this.prisma.user.update({ where: { id }, data: dto, include: { quota: true } }).catch(() => { throw new NotFoundException('User not found'); });
    await this.audit.log(actorId, 'user.update', { entity: 'user', entityId: id, ip, metadata: dto as unknown as Record<string, unknown> });
    return this.sanitize(u);
  }
  async setQuota(id: string, dto: QuotaDto, actorId: string, ip?: string) {
    const quota = await this.prisma.quota.upsert({ where: { userId: id }, update: dto, create: { userId: id, ...dto } });
    await this.audit.log(actorId, 'user.quota', { entity: 'user', entityId: id, ip });
    return quota;
  }
  async suspend(id: string, suspend: boolean, actorId: string, ip?: string) {
    const u = await this.prisma.user.update({ where: { id }, data: { status: suspend ? 'SUSPENDED' : 'ACTIVE' }, include: { quota: true } });
    if (suspend) await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log(actorId, suspend ? 'user.suspend' : 'user.unsuspend', { entity: 'user', entityId: id, ip });
    return this.sanitize(u);
  }
  async remove(id: string, actorId: string, ip?: string) {
    if (id === actorId) throw new BadRequestException('Cannot delete yourself');
    const active = await this.prisma.vm.count({ where: { ownerId: id, deletedAt: null } });
    if (active > 0) throw new BadRequestException('User still owns VMs. Transfer or delete them first.');
    await this.prisma.user.delete({ where: { id } });
    await this.audit.log(actorId, 'user.delete', { entity: 'user', entityId: id, ip });
    return { message: 'User deleted' };
  }
  async resetPassword(id: string, password: string, actorId: string, ip?: string) {
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), failedLoginCount: 0, lockedUntil: null } });
    await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log(actorId, 'user.reset_password', { entity: 'user', entityId: id, ip });
    return { message: 'Password reset; sessions revoked' };
  }
  async usage(userId: string) {
    const [quota, vms] = await Promise.all([this.prisma.quota.findUnique({ where: { userId } }), this.prisma.vm.findMany({ where: { ownerId: userId, deletedAt: null }, select: { vcpu: true, ramMb: true, diskGb: true } })]);
    const snaps = await this.prisma.snapshot.count({ where: { vm: { ownerId: userId } } });
    const backups = await this.prisma.backup.count({ where: { vm: { ownerId: userId } } });
    const ips = await this.prisma.ipAddress.count({ where: { vm: { ownerId: userId }, status: 'ASSIGNED' } });
    return { quota, used: { vms: vms.length, vcpu: vms.reduce((a, v) => a + v.vcpu, 0), ramMb: vms.reduce((a, v) => a + v.ramMb, 0), diskGb: vms.reduce((a, v) => a + v.diskGb, 0), snapshots: snaps, backups, ips } };
  }
  /** Throws BadRequestException if creating `need` would exceed quota. Used by VM create flow. */
  async assertQuota(userId: string, need: { vms?: number; vcpu: number; ramMb: number; diskGb: number }) {
    const { quota, used } = await this.usage(userId);
    if (!quota) throw new BadRequestException('No quota assigned');
    const checks: [string, number, number][] = [
      ['VMs', used.vms + (need.vms ?? 1), quota.maxVms], ['vCPU', used.vcpu + need.vcpu, quota.maxVCpu],
      ['RAM (MB)', used.ramMb + need.ramMb, quota.maxRamMb], ['Disk (GB)', used.diskGb + need.diskGb, quota.maxDiskGb],
    ];
    for (const [label, val, max] of checks) if (val > max) throw new BadRequestException(`Quota exceeded: ${label} ${val}/${max}`);
  }
  sanitize(u: Record<string, any>) { const { passwordHash, twoFactorSecret, emailVerifyTokenHash, passwordResetTokenHash, ...rest } = u; return rest; }
  async exportCsv(q: { search?: string }) {
    const { data } = await this.list({ ...q, page: 1, limit: 100 });
    const rows = [['id', 'name', 'email', 'role', 'status', 'createdAt'], ...data.map((u: any) => [u.id, u.name, u.email, u.role, u.status, u.createdAt?.toISOString?.() || ''])];
    return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  }
}
