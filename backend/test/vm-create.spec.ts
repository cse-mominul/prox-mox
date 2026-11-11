import { VmsService } from '../src/vms/vms.service';
/** VM create flow with mocked Proxmox API: quota checked, next VMID allocated, task tracked. */
describe('VmsService.create (mocked Proxmox)', () => {
  it('clones/creates with next free VMID and returns taskId', async () => {
    const pve = { nextVmid: jest.fn(async () => '101'), post: jest.fn(async () => 'UPID:pve1:0001') } as never;
    const prisma = {
      plan: { findUniqueOrThrow: async () => ({ vcpu: 2, ramMb: 2048, diskGb: 20 }) },
      ipAddress: { findFirst: async () => null, update: jest.fn() },
      vm: { create: jest.fn(async ({ data }: any) => ({ id: 'vm1', ...data })) },
      quota: { findUnique: async () => ({ maxSnapshots: 5 }) },
    } as never;
    const users = { assertQuota: jest.fn(async () => undefined), usage: jest.fn(async () => ({ used: { snapshots: 0 } })) } as never;
    const clusters = { getRaw: jest.fn(async () => ({ id: 'c1', name: 'prod' })), leastLoadedNode: jest.fn(async () => 'pve1') } as never;
    const tasks = { create: jest.fn(async () => ({ id: 't1' })), update: jest.fn() } as never;
    const queue = { enqueueUpidPoll: jest.fn(async () => undefined) } as never;
    const svc = new VmsService(prisma, pve, clusters, users, tasks, queue, { pollUpid: jest.fn() } as never, { log: jest.fn() } as never, { create: jest.fn() } as never);
    const res = await svc.create({ clusterId: 'c1', name: 'web-1', planId: 'p1' }, { id: 'u1', role: 'USER' });
    expect((pve as any).nextVmid).toHaveBeenCalled();
    expect(res.vm.vmid).toBe(101); expect(res.taskId).toBe('t1');
    expect((users as any).assertQuota).toHaveBeenCalled();
  });
  it('fails before calling Proxmox when quota exceeded', async () => {
    const pve = { nextVmid: jest.fn(), post: jest.fn() } as never;
    const users = { assertQuota: jest.fn(async () => { throw new Error('Quota exceeded: VMs 4/3'); }) } as never;
    const svc = new VmsService({ plan: {} } as never, pve, { getRaw: jest.fn() } as never, users, {} as never, {} as never, {} as never, { log: jest.fn() } as never, {} as never);
    await expect(svc.create({ clusterId: 'c1', name: 'x' }, { id: 'u1', role: 'USER' })).rejects.toThrow(/Quota/);
    expect((pve as any).post).not.toHaveBeenCalled();
  });
});
