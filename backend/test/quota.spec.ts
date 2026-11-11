import { UsersService } from '../src/users/users.service';
describe('UsersService.assertQuota', () => {
  it('throws when VM count would exceed quota', async () => {
    const prisma = {
      quota: { findUnique: async () => ({ maxVms: 1, maxVCpu: 8, maxRamMb: 16384, maxDiskGb: 200, maxSnapshots: 5, maxBackups: 5, maxIps: 2 }) },
      vm: { findMany: async () => [{ vcpu: 1, ramMb: 1024, diskGb: 10 }] },
      snapshot: { count: async () => 0 }, backup: { count: async () => 0 }, ipAddress: { count: async () => 0 },
    } as never;
    const svc = new UsersService(prisma, { log: async () => undefined } as never);
    await expect(svc.assertQuota('u1', { vcpu: 1, ramMb: 512, diskGb: 5 })).rejects.toThrow(/Quota exceeded/);
    await expect(new UsersService({ quota: { findUnique: async () => ({ maxVms: 5, maxVCpu: 8, maxRamMb: 16384, maxDiskGb: 200, maxSnapshots: 5, maxBackups: 5, maxIps: 2 }) }, vm: { findMany: async () => [] }, snapshot: { count: async () => 0 }, backup: { count: async () => 0 }, ipAddress: { count: async () => 0 } } as never, { log: async () => undefined } as never).assertQuota('u1', { vcpu: 1, ramMb: 512, diskGb: 5 })).resolves.toBeUndefined();
  });
});
