import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators';
class CreateKeyDto { @ApiProperty() @IsString() @Length(1, 60) name!: string; @ApiPropertyOptional() @IsOptional() @IsArray() scopes?: string[]; }
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
@ApiTags('api-keys') @ApiBearerAuth() @Controller('api-keys')
export class ApiKeysController {
  constructor(private prisma: PrismaService) {}
  /** Personal API keys: plaintext shown once; only SHA-256 hash + prefix stored. Scopes e.g. ["vms:read","vms:write"]. */
  @Post() async create(@Body() dto: CreateKeyDto, @CurrentUser() u: AuthUser) {
    const raw = `pk_${randomBytes(24).toString('hex')}`;
    const key = await this.prisma.apiKey.create({ data: { userId: u.id, name: dto.name, keyPrefix: raw.slice(0, 11), keyHash: sha256(raw), scopes: dto.scopes || ['vms:read'] } });
    return { ...key, plainTextKey: raw, warning: 'Store this key now — it will not be shown again.' };
  }
  @Get() list(@CurrentUser() u: AuthUser) { return this.prisma.apiKey.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true } }); }
  @Delete(':id') async revoke(@Param('id') id: string, @CurrentUser() u: AuthUser) { await this.prisma.apiKey.updateMany({ where: { id, userId: u.id }, data: { revokedAt: new Date() } }); return { message: 'API key revoked' }; }
}
