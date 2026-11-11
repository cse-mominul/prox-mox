import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { encryptSecret, decryptSecret, sha256, randomToken } from '../common/utils/crypto';
import { RegisterDto } from './dto/auth.dto';

const MAX_FAILED = 5; const LOCK_MINUTES = 15;
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private mail: MailService, private audit: AuditService) {}
  private accessSecret() { return process.env.JWT_ACCESS_SECRET || 'dev-access-secret'; }
  private refreshSecret() { return process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret'; }
  async signTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.accessSecret(), expiresIn: process.env.JWT_ACCESS_TTL || '15m' });
    const refreshToken = await this.jwt.signAsync(payload, { secret: this.refreshSecret(), expiresIn: `${Number(process.env.JWT_REFRESH_TTL_DAYS || 7)}d` });
    return { accessToken, refreshToken };
  }
  async createSession(userId: string, refreshToken: string, ip?: string, userAgent?: string) {
    const days = Number(process.env.JWT_REFRESH_TTL_DAYS || 7);
    return this.prisma.session.create({ data: { userId, refreshTokenHash: sha256(refreshToken), ip, userAgent, expiresAt: new Date(Date.now() + days * 86400_000) } });
  }
  async registrationEnabled(): Promise<boolean> {
    const s = await this.prisma.setting.findUnique({ where: { key: 'registration_enabled' } });
    if (s) return s.value === true;
    return process.env.REGISTRATION_ENABLED !== 'false';
  }
  async defaultQuota() {
    const s = await this.prisma.setting.findUnique({ where: { key: 'default_quota' } });
    return (s?.value as Record<string, number>) || { maxVms: 3, maxVCpu: 8, maxRamMb: 16384, maxDiskGb: 200, maxSnapshots: 10, maxBackups: 10, maxIps: 3 };
  }
  async register(dto: RegisterDto, ip?: string) {
    if (!(await this.registrationEnabled())) throw new ForbiddenException('Registration is disabled');
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) throw new BadRequestException('Email already registered');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const verifyRaw = randomToken();
    const user = await this.prisma.user.create({ data: { email: dto.email.toLowerCase(), name: dto.name, passwordHash, emailVerifyTokenHash: sha256(verifyRaw), quota: { create: await this.defaultQuota() } } });
    await this.mail.verifyEmail(user.email, verifyRaw).catch(() => undefined);
    await this.audit.log(user.id, 'auth.register', { ip });
    return { id: user.id, email: user.email, message: 'Registered. Please verify your email.' };
  }
  async verifyEmail(rawToken: string) {
    const user = await this.prisma.user.findFirst({ where: { emailVerifyTokenHash: sha256(rawToken) } });
    if (!user) throw new BadRequestException('Invalid verification token');
    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), status: 'ACTIVE', emailVerifyTokenHash: null } });
    return { message: 'Email verified' };
  }
  async login(email: string, password: string, totp: string | undefined, ip?: string, userAgent?: string) {
    const fail = async (reason: string) => { await this.prisma.loginAttempt.create({ data: { email: email.toLowerCase(), ip, success: false, reason } }); throw new UnauthorizedException(reason); };
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return fail('Invalid credentials');
    if (user!.lockedUntil && user!.lockedUntil > new Date()) return fail('Account locked. Try again later.');
    if (user!.status === 'SUSPENDED') return fail('Account suspended');
    const ok = await argon2.verify(user!.passwordHash, password).catch(() => false);
    if (!ok) {
      const count = user!.failedLoginCount + 1;
      await this.prisma.user.update({ where: { id: user!.id }, data: { failedLoginCount: count, lockedUntil: count >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user!.lockedUntil } });
      return fail('Invalid credentials');
    }
    if (user!.twoFactorEnabled) {
      if (!totp) throw new UnauthorizedException('2FA code required');
      const secret = decryptSecret(user!.twoFactorSecret!);
      const valid = authenticator.verify({ token: totp.replace(/\s/g, ''), secret }) || user!.backupCodes.includes(sha256(totp.toUpperCase()));
      if (!valid) return fail('Invalid 2FA code');
      if (user!.backupCodes.includes(sha256(totp.toUpperCase()))) {
        await this.prisma.user.update({ where: { id: user!.id }, data: { backupCodes: user!.backupCodes.filter((c) => c !== sha256(totp.toUpperCase())) } });
      }
    }
    await this.prisma.user.update({ where: { id: user!.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.prisma.loginAttempt.create({ data: { email: user!.email, ip, success: true } });
    const tokens = await this.signTokens(user!);
    const session = await this.createSession(user!.id, tokens.refreshToken, ip, userAgent);
    await this.audit.log(user!.id, 'auth.login', { ip, userAgent });
    return { user: this.publicUser(user!), ...tokens, sessionId: session.id };
  }
  async refresh(refreshToken: string, ip?: string, userAgent?: string) {
    let payload: { sub: string };
    try { payload = await this.jwt.verifyAsync(refreshToken, { secret: this.refreshSecret() }); } catch { throw new UnauthorizedException('Invalid refresh token'); }
    const session = await this.prisma.session.findFirst({ where: { userId: payload.sub, refreshTokenHash: sha256(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session) throw new UnauthorizedException('Session revoked or expired');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'SUSPENDED') throw new UnauthorizedException('Account unavailable');
    // Rotate refresh token
    const tokens = await this.signTokens(user);
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const next = await this.createSession(user.id, tokens.refreshToken, ip, userAgent);
    return { user: this.publicUser(user), ...tokens, sessionId: next.id };
  }
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) await this.prisma.session.updateMany({ where: { userId, refreshTokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { message: 'Logged out' };
  }
  async forgot(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const raw = randomToken();
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordResetTokenHash: sha256(raw), passwordResetExpires: new Date(Date.now() + 3600_000) } });
      await this.mail.resetPassword(user.email, raw).catch(() => undefined);
    }
    return { message: 'If the email exists, a reset link was sent.' }; // no user enumeration
  }
  async reset(rawToken: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { passwordResetTokenHash: sha256(rawToken), passwordResetExpires: { gt: new Date() } } });
    if (!user) throw new BadRequestException('Invalid or expired reset token');
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), passwordResetTokenHash: null, passwordResetExpires: null, failedLoginCount: 0, lockedUntil: null } });
    await this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { message: 'Password reset. Please log in.' };
  }
  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, current).catch(() => false))) throw new BadRequestException('Current password incorrect');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(next, { type: argon2.argon2id }) } });
    return { message: 'Password changed' };
  }
  // --- 2FA (TOTP) ---
  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, process.env.APP_NAME || 'ProxmoxPortal', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: encryptSecret(secret) } });
    return { secret, otpauth, qrDataUrl };
  }
  async enable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) throw new BadRequestException('Run 2FA setup first');
    if (!authenticator.verify({ token: code.replace(/\s/g, ''), secret: decryptSecret(user.twoFactorSecret) })) throw new BadRequestException('Invalid code');
    const codes = Array.from({ length: 8 }, () => randomToken(5).toUpperCase());
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, backupCodes: codes.map(sha256) } });
    return { backupCodes: codes, message: '2FA enabled. Store backup codes safely.' };
  }
  async disable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new BadRequestException('2FA not enabled');
    if (!authenticator.verify({ token: code.replace(/\s/g, ''), secret: decryptSecret(user.twoFactorSecret) })) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null, backupCodes: [] } });
    return { message: '2FA disabled' };
  }
  publicUser(u: { id: string; email: string; name: string; role: string; status: string; twoFactorEnabled: boolean; createdAt: Date }) {
    return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, twoFactorEnabled: u.twoFactorEnabled, createdAt: u.createdAt };
  }
}
