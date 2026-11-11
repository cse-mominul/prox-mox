import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotDto, ResetDto, ChangePasswordDto, TokenDto, VerifyTotpDto } from './dto/auth.dto';
import { Public, CurrentUser, AuthUser, ClientIp } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1/auth', maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS || 7) * 86400_000 });
}
@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}
  @Public() @Throttle({ default: { limit: 5, ttl: 60000 } }) @Post('register')
  register(@Body() dto: RegisterDto, @ClientIp() ip: string) { return this.auth.register(dto, ip); }
  @Public() @Throttle({ default: { limit: 10, ttl: 60000 } }) @Post('login')
  async login(@Body() dto: LoginDto, @ClientIp() ip: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto.email, dto.password, dto.totp, ip, req.headers['user-agent']);
    setRefreshCookie(res, r.refreshToken);
    return { user: r.user, accessToken: r.accessToken, sessionId: r.sessionId };
  }
  @Public() @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).cookies?.refresh_token || req.body?.refreshToken;
    const r = await this.auth.refresh(token, req.ip, req.headers['user-agent']);
    setRefreshCookie(res, r.refreshToken);
    return { user: r.user, accessToken: r.accessToken, sessionId: r.sessionId };
  }
  @ApiBearerAuth() @Post('logout')
  async logout(@CurrentUser() u: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(u.id, (req as any).cookies?.refresh_token);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { message: 'Logged out' };
  }
  @Public() @Post('forgot-password') forgot(@Body() dto: ForgotDto) { return this.auth.forgot(dto.email); }
  @Public() @Post('reset-password') reset(@Body() dto: ResetDto) { return this.auth.reset(dto.token, dto.password); }
  @Public() @Post('verify-email') verify(@Body() dto: TokenDto) { return this.auth.verifyEmail(dto.token); }
  @ApiBearerAuth() @Get('me') async me(@CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { quota: true } });
    return { ...this.auth.publicUser(user), emailVerified: !!user.emailVerifiedAt, quota: user.quota };
  }
  @ApiBearerAuth() @Post('change-password') change(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(u.id, dto.currentPassword, dto.newPassword); }
  @ApiBearerAuth() @Post('2fa/setup') setup2fa(@CurrentUser() u: AuthUser) { return this.auth.setup2fa(u.id); }
  @ApiBearerAuth() @Post('2fa/enable') enable2fa(@CurrentUser() u: AuthUser, @Body() dto: VerifyTotpDto) { return this.auth.enable2fa(u.id, dto.code); }
  @ApiBearerAuth() @Post('2fa/disable') disable2fa(@CurrentUser() u: AuthUser, @Body() dto: VerifyTotpDto) { return this.auth.disable2fa(u.id, dto.code); }
  @ApiBearerAuth() @Get('sessions') sessions(@CurrentUser() u: AuthUser) {
    return this.prisma.session.findMany({ where: { userId: u.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true } });
  }
  @ApiBearerAuth() @Post('sessions/revoke-all') async revokeAll(@CurrentUser() u: AuthUser, @Req() req: Request) {
    await this.prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    void req; return { message: 'All sessions revoked' };
  }
}
