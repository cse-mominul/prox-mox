import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../types';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export interface AuthUser { id: string; email: string; role: Role; }
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
export const ClientIp = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').trim();
});
