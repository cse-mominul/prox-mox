/** Shared domain enums/types. Kept independent of generated @prisma/client so the
 *  codebase type-checks before `prisma generate`; values match schema.prisma exactly. */
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'USER';
export const Role = { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', RESELLER: 'RESELLER', USER: 'USER' } as const;
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
export const UserStatus = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', PENDING_VERIFICATION: 'PENDING_VERIFICATION' } as const;
export type VmType = 'QEMU' | 'LXC';
export const VmType = { QEMU: 'QEMU', LXC: 'LXC' } as const;
export type BackupMode = 'SNAPSHOT' | 'SUSPEND' | 'STOP';
export const BackupMode = { SNAPSHOT: 'SNAPSHOT', SUSPEND: 'SUSPEND', STOP: 'STOP' } as const;
export type TaskStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type NotificationType = 'VM_CREATED' | 'VM_DELETED' | 'BACKUP_FAILED' | 'HIGH_USAGE' | 'TASK_FAILED' | 'SYSTEM';
export interface ClusterLike { id: string; name: string; host: string; port: number; tokenId: string; tokenSecretEnc: string; verifyTls: boolean; }
