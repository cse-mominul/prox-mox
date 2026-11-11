import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types';
import { ROLES_KEY, PERMISSIONS_KEY } from '../decorators';
/** Permission map: fine-grained permissions derived from role. Guards check either @Roles or @RequirePermissions. */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['users:read','users:write','clusters:read','clusters:write','vms:read:any','vms:write:any','plans:write','ipam:write','audit:read','settings:write','tickets:write'],
  RESELLER: ['users:read','vms:read:any','vms:write:any'],
  USER: ['vms:read:own','vms:write:own','tickets:write:own'],
};
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const perms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length && !perms?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Authentication required');
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('Insufficient role');
    if (perms?.length) {
      const owned = ROLE_PERMISSIONS[user.role as Role] || [];
      const ok = owned.includes('*') || perms.every((p) => owned.includes(p) || owned.includes(p.replace(':own', ':any')));
      if (!ok) throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
