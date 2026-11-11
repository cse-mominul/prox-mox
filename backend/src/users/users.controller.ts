import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, QuotaDto, ResetPasswordDto } from './dto/users.dto';
import { Roles, CurrentUser, AuthUser, ClientIp } from '../common/decorators';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users') @ApiBearerAuth() @Controller('users')
export class UsersController {
  constructor(private users: UsersService, private auth: AuthService, private prisma: PrismaService) {}
  @Roles('SUPER_ADMIN', 'ADMIN') @Post() create(@Body() dto: CreateUserDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.users.create(dto, u.id, ip); }
  @Roles('SUPER_ADMIN', 'ADMIN', 'RESELLER') @Get() list(@Query() q: Record<string, string>) { return this.users.list(q as never); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Get('export.csv') async csv(@Query() q: Record<string, string>, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(await this.users.exportCsv(q));
  }
  @Get('me/usage') myUsage(@CurrentUser() u: AuthUser) { return this.users.usage(u.id); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    if (u.role === 'USER' && u.id !== id) return this.users.get(u.id);
    return this.users.get(id);
  }
  @Roles('SUPER_ADMIN', 'ADMIN') @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.users.update(id, dto, u.id, ip); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Patch(':id/quota') quota(@Param('id') id: string, @Body() dto: QuotaDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.users.setQuota(id, dto, u.id, ip); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post(':id/suspend') suspend(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.users.suspend(id, true, u.id, ip); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post(':id/unsuspend') unsuspend(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.users.suspend(id, false, u.id, ip); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post(':id/reset-password') resetPw(@Param('id') id: string, @Body() dto: ResetPasswordDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.users.resetPassword(id, dto.password, u.id, ip); }
  @Roles('SUPER_ADMIN') @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.users.remove(id, u.id, ip); }
  /** Impersonation ("login as"): SUPER_ADMIN only, fully audited. Returns short-lived tokens for target user. */
  @Roles('SUPER_ADMIN') @Post(':id/impersonate') async impersonate(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'user.impersonate', entity: 'user', entityId: id, ip, metadata: { impersonatedEmail: target.email } } });
    const tokens = await this.auth.signTokens(target);
    await this.auth.createSession(target.id, tokens.refreshToken, ip, `Impersonated by ${u.email}`);
    return { user: this.auth.publicUser(target), accessToken: tokens.accessToken, impersonatedBy: u.email };
  }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post(':id/transfer-vms') async transfer(@Param('id') id: string, @Body() dto: { toUserId: string }, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    void u; void ip;
    await this.prisma.vm.updateMany({ where: { ownerId: id }, data: { ownerId: dto.toUserId } });
    return { message: 'VMs transferred' };
  }
}
