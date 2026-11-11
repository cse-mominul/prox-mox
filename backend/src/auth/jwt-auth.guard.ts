import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from '../common/utils/crypto';
/** Accepts Bearer JWT access token OR personal API key (Authorization: Bearer pk_...). */
@Injectable()
export class JwtAuthGuard {
  constructor(private jwt: JwtService, private reflector: Reflector, private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');
    if (token.startsWith('pk_')) {
      const key = await this.prisma.apiKey.findUnique({ where: { keyHash: sha256(token) }, include: { user: true } });
      if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) throw new UnauthorizedException('Invalid API key');
      await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
      req.user = { id: key.user.id, email: key.user.email, role: key.user.role, scopes: key.scopes, viaApiKey: true };
      req.apiKeyScopes = key.scopes;
      return true;
    }
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret' });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status === 'SUSPENDED') throw new UnauthorizedException('Account unavailable');
      req.user = { id: user.id, email: user.email, role: user.role };
      return true;
    } catch { throw new UnauthorizedException('Invalid or expired token'); }
  }
}
