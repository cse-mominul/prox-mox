import { PrismaClient } from '@prisma/client';
const Role = { SUPER_ADMIN: 'SUPER_ADMIN' } as const;
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe!2024';
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: Role.SUPER_ADMIN, status: 'ACTIVE', emailVerifiedAt: new Date() },
    create: { email, name: process.env.SUPER_ADMIN_NAME || 'Super Admin', passwordHash: hash, role: Role.SUPER_ADMIN, status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  await prisma.quota.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id, maxVms: 1000, maxVCpu: 10000, maxRamMb: 10_000_000, maxDiskGb: 1_000_000, maxSnapshots: 10000, maxBackups: 10000, maxIps: 1000 } });
  const plans = [
    { name: 'Basic', description: 'Starter VPS', vcpu: 1, ramMb: 1024, diskGb: 25, priceMonthly: 5 },
    { name: 'Pro', description: 'Production VPS', vcpu: 4, ramMb: 8192, diskGb: 100, priceMonthly: 24 },
    { name: 'Business', description: 'High performance', vcpu: 8, ramMb: 16384, diskGb: 200, priceMonthly: 49 },
  ];
  for (const p of plans) await prisma.plan.upsert({ where: { name: p.name }, update: p, create: p });
  const defaults: Record<string, unknown> = {
    registration_enabled: process.env.REGISTRATION_ENABLED !== 'false',
    maintenance_mode: false,
    site_name: 'Proxmox Portal',
    default_quota: { maxVms: 3, maxVCpu: 8, maxRamMb: 16384, maxDiskGb: 200, maxSnapshots: 10, maxBackups: 10, maxIps: 3 },
  };
  for (const [key, value] of Object.entries(defaults)) await prisma.setting.upsert({ where: { key }, update: { value: value as object }, create: { key, value: value as object } });
  console.log(`Seeded SUPER_ADMIN ${email} and plans Basic/Pro/Business`);
}
main().finally(() => prisma.$disconnect());
