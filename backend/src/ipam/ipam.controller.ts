import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PoolDto } from './dto/ipam.dto';
import { Roles } from '../common/decorators';
function ipToInt(ip: string) { return ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0; }
function intToIp(n: number) { return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.'); }
@ApiTags('ipam') @ApiBearerAuth() @Controller('ip-pools')
export class IpamController {
  constructor(private prisma: PrismaService) {}
  @Get() list() { return this.prisma.ipPool.findMany({ include: { addresses: { select: { status: true } }, _count: { select: { addresses: true } } } }); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post() async create(@Body() dto: PoolDto) {
    const [start, end] = dto.range.split('-').map((s) => s.trim());
    if (!start || !end) throw new BadRequestException('range must be like 10.0.0.10-10.0.0.50');
    const a = ipToInt(start); const b = ipToInt(end);
    if (b < a || b - a > 4096) throw new BadRequestException('Invalid or too large range (max 4096)');
    const ips: string[] = []; for (let n = a; n <= b; n++) ips.push(intToIp(n));
    return this.prisma.ipPool.create({ data: { name: dto.name, clusterId: dto.clusterId, bridge: dto.bridge || 'vmbr0', vlan: dto.vlan, gateway: dto.gateway, netmask: dto.netmask, dns: dto.dns, addresses: { create: ips.map((ip) => ({ ip })) } }, include: { _count: { select: { addresses: true } } } });
  }
  @Get(':id/addresses') addresses(@Param('id') id: string) { return this.prisma.ipAddress.findMany({ where: { poolId: id }, orderBy: { ip: 'asc' }, include: { vm: { select: { id: true, name: true } } } }); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post(':id/addresses/:addrId/reserve') async reserve(@Param('addrId') addrId: string) { return this.prisma.ipAddress.update({ where: { id: addrId }, data: { status: 'RESERVED' } }); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post(':id/addresses/:addrId/free') async free(@Param('addrId') addrId: string) { return this.prisma.ipAddress.update({ where: { id: addrId }, data: { status: 'FREE', vmId: null } }); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Delete(':id') remove(@Param('id') id: string) { return this.prisma.ipPool.delete({ where: { id } }); }
}
