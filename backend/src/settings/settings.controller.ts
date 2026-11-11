import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, Public } from '../common/decorators';
const KEYS = ['site_name', 'site_logo_url', 'registration_enabled', 'maintenance_mode', 'default_quota', 'smtp'];
@ApiTags('settings') @Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}
  @Public() @Get('public') async pub() {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: ['site_name', 'site_logo_url', 'registration_enabled', 'maintenance_mode'] } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
  @ApiBearerAuth() @Roles('SUPER_ADMIN', 'ADMIN') @Get() async all() {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
  @ApiBearerAuth() @Roles('SUPER_ADMIN') @Put() async update(@Body() body: Record<string, unknown>) {
    for (const [key, value] of Object.entries(body)) {
      if (!KEYS.includes(key) && !key.startsWith('smtp')) continue;
      await this.prisma.setting.upsert({ where: { key }, update: { value: value as object }, create: { key, value: value as object } });
    }
    return this.all();
  }
}
