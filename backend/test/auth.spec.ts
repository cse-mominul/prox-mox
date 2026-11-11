import { AuthService } from '../src/auth/auth.service';
/** Auth unit tests with in-memory Prisma fake (no DB needed). */
function fakePrisma() {
  const users: any[] = []; const sessions: any[] = [];
  return {
    users, sessions,
    setting: { findUnique: async ({ where }: any) => (where.key === 'registration_enabled' ? { value: true } : where.key === 'default_quota' ? { value: { maxVms: 3, maxVCpu: 8, maxRamMb: 16384, maxDiskGb: 200, maxSnapshots: 10, maxBackups: 10, maxIps: 3 } } : null) },
    user: {
      findUnique: async ({ where }: any) => users.find((u) => u.email === where.email || u.id === where.id) || null,
      findFirst: async () => null,
      create: async ({ data }: any) => { const u = { id: `u${users.length + 1}`, createdAt: new Date(), failedLoginCount: 0, backupCodes: [], ...data, quota: data.quota?.create }; users.push(u); return u; },
      update: async ({ where, data }: any) => { const u = users.find((x) => x.id === where.id); Object.assign(u, data); return u; },
    },
    session: { create: async ({ data }: any) => { const s = { id: 's1', ...data }; sessions.push(s); return s; }, updateMany: async () => ({ count: 1 }), findFirst: async () => null, update: async ({ data }: any) => data },
    loginAttempt: { create: async () => ({}) },
  } as never;
}
const jwt = { signAsync: async () => 'tok', verifyAsync: async () => ({ sub: 'u1' }) } as never;
const mail = { verifyEmail: async () => undefined, resetPassword: async () => undefined, notify: async () => undefined } as never;
const audit = { log: async () => undefined } as never;

describe('AuthService', () => {
  it('registers, hashes with argon2 and logs in', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access'; process.env.JWT_REFRESH_SECRET = 'test-refresh';
    const svc = new AuthService(fakePrisma(), jwt, mail, audit);
    const reg = await svc.register({ name: 'Test User', email: 'a@test.dev', password: 'pass1234' });
    expect(reg.email).toBe('a@test.dev');
    const login = await svc.login('a@test.dev', 'pass1234', undefined, '127.0.0.1', 'jest');
    expect(login.accessToken).toBe('tok'); expect(login.user.email).toBe('a@test.dev');
  });
  it('rejects wrong password', async () => {
    const svc = new AuthService(fakePrisma(), jwt, mail, audit);
    await svc.register({ name: 'T U', email: 'b@test.dev', password: 'pass1234' });
    await expect(svc.login('b@test.dev', 'wrong123', undefined)).rejects.toThrow();
  });
});
