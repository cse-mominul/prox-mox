import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProxmoxService } from '../proxmox/proxmox.service';
import { encryptSecret } from '../common/utils/crypto';
import { CreateClusterDto, UpdateClusterDto } from './dto/clusters.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClustersService {
  constructor(private prisma: PrismaService, private pve: ProxmoxService, private audit: AuditService) {}
  sanitize<T extends Record<string, any>>(c: T) { const { tokenSecretEnc, ...rest } = c; return { ...rest, hasTokenSecret: !!tokenSecretEnc }; }
  async create(dto: CreateClusterDto, actorId: string, ip?: string) {
    const c = await this.prisma.cluster.create({ data: { name: dto.name, host: dto.host, port: dto.port || 8006, tokenId: dto.tokenId, tokenSecretEnc: encryptSecret(dto.tokenSecret), verifyTls: dto.verifyTls || false } });
    await this.audit.log(actorId, 'cluster.create', { entity: 'cluster', entityId: c.id, ip });
    return this.sanitize(c);
  }
  async list() { const cs = await this.prisma.cluster.findMany({ orderBy: { createdAt: 'asc' }, include: { nodes: true, _count: { select: { vms: true } } } }); return cs.map((c) => this.sanitize(c)); }
  async getRaw(id: string) { const c = await this.prisma.cluster.findUnique({ where: { id } }); if (!c) throw new NotFoundException('Cluster not found'); return c; }
  async get(id: string) { return this.sanitize(await this.getRaw(id)); }
  async update(id: string, dto: UpdateClusterDto, actorId: string, ip?: string) {
    const { tokenSecret, ...rest } = dto;
    const c = await this.prisma.cluster.update({ where: { id }, data: { ...rest, ...(tokenSecret ? { tokenSecretEnc: encryptSecret(tokenSecret) } : {}) } });
    this.pve.invalidate(id);
    await this.audit.log(actorId, 'cluster.update', { entity: 'cluster', entityId: id, ip });
    return this.sanitize(c);
  }
  async remove(id: string, actorId: string, ip?: string) {
    await this.prisma.cluster.delete({ where: { id } }); this.pve.invalidate(id);
    await this.audit.log(actorId, 'cluster.delete', { entity: 'cluster', entityId: id, ip });
    return { message: 'Cluster removed' };
  }
  /** Test connection + sync node list into DB. */
  async testConnection(id: string) {
    const c = await this.getRaw(id);
    try {
      const [version, nodes] = await Promise.all([this.pve.version(c), this.pve.nodes(c)]);
      for (const n of nodes as any[]) {
        await this.prisma.node.upsert({ where: { clusterId_name: { clusterId: c.id, name: n.node } }, update: { status: n.status, cpuUsage: n.cpu, maxCpu: n.maxcpu, memUsed: BigInt(Math.round(n.mem || 0)), memTotal: BigInt(Math.round(n.maxmem || 0)) }, create: { clusterId: c.id, name: n.node, status: n.status, cpuUsage: n.cpu, maxCpu: n.maxcpu, memUsed: BigInt(Math.round(n.mem || 0)), memTotal: BigInt(Math.round(n.maxmem || 0)) } });
      }
      await this.prisma.cluster.update({ where: { id }, data: { lastSeenAt: new Date(), lastError: null } });
      return { ok: true, version, nodes };
    } catch (e) {
      await this.prisma.cluster.update({ where: { id }, data: { lastError: (e as Error).message } });
      throw e;
    }
  }
  async nodes(id: string) { const c = await this.getRaw(id); return this.pve.nodes(c); }
  async nodeResources(id: string) {
    const c = await this.getRaw(id);
    const nodes = await this.pve.nodes(c);
    return nodes;
  }
  async storages(id: string, node: string) { return this.pve.storages(await this.getRaw(id), node); }
  async isos(id: string, node: string, storage: string) { return this.pve.storageContent(await this.getRaw(id), node, storage, 'iso'); }
  async templates(id: string, node: string) { return this.pve.templates(await this.getRaw(id), node); }
  async bridges(id: string, node: string) { return this.pve.bridges(await this.getRaw(id), node); }
  /** Pick least-loaded online node (for wizard auto-select). */
  async leastLoadedNode(id: string): Promise<string> {
    const nodes = await this.nodes(id);
    const online = (nodes as any[]).filter((n) => n.status === 'online');
    if (!online.length) throw new NotFoundException('No online nodes in cluster');
    online.sort((a, b) => (a.cpu || 0) + (a.mem / Math.max(1, a.maxmem)) - ((b.cpu || 0) + (b.mem / Math.max(1, b.maxmem))));
    return online[0].node;
  }
}
