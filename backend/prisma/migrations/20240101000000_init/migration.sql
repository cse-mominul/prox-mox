-- Initial migration generated from prisma/schema.prisma (applies with: prisma migrate deploy)

CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'RESELLER', 'USER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');
CREATE TYPE "VmType" AS ENUM ('QEMU', 'LXC');
CREATE TYPE "VmStatus" AS ENUM ('RUNNING', 'STOPPED', 'SUSPENDED', 'UNKNOWN', 'DELETED');
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "IpStatus" AS ENUM ('FREE', 'ASSIGNED', 'RESERVED');
CREATE TYPE "BackupMode" AS ENUM ('SNAPSHOT', 'SUSPEND', 'STOP');
CREATE TYPE "NotificationType" AS ENUM ('VM_CREATED', 'VM_DELETED', 'BACKUP_FAILED', 'HIGH_USAGE', 'TASK_FAILED', 'SYSTEM');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "backupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "emailVerifyTokenHash" TEXT,
    "passwordResetTokenHash" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Quota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxVms" INTEGER NOT NULL DEFAULT 3,
    "maxVCpu" INTEGER NOT NULL DEFAULT 8,
    "maxRamMb" INTEGER NOT NULL DEFAULT 16384,
    "maxDiskGb" INTEGER NOT NULL DEFAULT 200,
    "maxSnapshots" INTEGER NOT NULL DEFAULT 10,
    "maxBackups" INTEGER NOT NULL DEFAULT 10,
    "maxIps" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quota_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quota_userId_key" ON "Quota"("userId");

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8006,
    "tokenId" TEXT NOT NULL,
    "tokenSecretEnc" TEXT NOT NULL,
    "verifyTls" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cluster_name_key" ON "Cluster"("name");

CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT "unknown",
    "cpuUsage" DOUBLE PRECISION,
    "maxCpu" INTEGER,
    "memUsed" BIGINT,
    "memTotal" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vcpu" INTEGER NOT NULL,
    "ramMb" INTEGER NOT NULL,
    "diskGb" INTEGER NOT NULL,
    "priceMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

CREATE TABLE "Vm" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "planId" TEXT,
    "node" TEXT NOT NULL,
    "vmid" INTEGER NOT NULL,
    "type" "VmType" NOT NULL DEFAULT 'QEMU',
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "status" "VmStatus" NOT NULL DEFAULT 'STOPPED',
    "vcpu" INTEGER NOT NULL DEFAULT 1,
    "ramMb" INTEGER NOT NULL DEFAULT 1024,
    "diskGb" INTEGER NOT NULL DEFAULT 10,
    "storage" TEXT NOT NULL DEFAULT "local-lvm",
    "bridge" TEXT NOT NULL DEFAULT "vmbr0",
    "vlan" INTEGER,
    "ipAddress" TEXT,
    "template" TEXT,
    "description" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IpPool" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT,
    "name" TEXT NOT NULL,
    "bridge" TEXT NOT NULL DEFAULT "vmbr0",
    "vlan" INTEGER,
    "gateway" TEXT NOT NULL,
    "netmask" TEXT NOT NULL DEFAULT "255.255.255.0",
    "dns" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IpPool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IpAddress" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "status" "IpStatus" NOT NULL DEFAULT 'FREE',
    "vmId" TEXT,
    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "proxmoxCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "volid" TEXT,
    "storage" TEXT NOT NULL DEFAULT "local",
    "mode" "BackupMode" NOT NULL DEFAULT 'SNAPSHOT',
    "scheduleCron" TEXT,
    "sizeBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupSchedule" (
    "id" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "storage" TEXT NOT NULL DEFAULT "local",
    "mode" "BackupMode" NOT NULL DEFAULT 'SNAPSHOT',
    "retention" INTEGER NOT NULL DEFAULT 3,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FirewallRule" (
    "id" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "dir" TEXT NOT NULL,
    "proto" TEXT,
    "dport" TEXT,
    "source" TEXT,
    "dest" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FirewallRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "vmId" TEXT,
    "clusterId" TEXT,
    "node" TEXT,
    "upid" TEXT,
    "action" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "Quota" ADD CONSTRAINT "Quota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Node" ADD CONSTRAINT "Node_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE;
ALTER TABLE "Vm" ADD CONSTRAINT "Vm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ;
ALTER TABLE "Vm" ADD CONSTRAINT "Vm_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ;
ALTER TABLE "Vm" ADD CONSTRAINT "Vm_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ;
ALTER TABLE "IpPool" ADD CONSTRAINT "IpPool_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL;
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "IpPool"("id") ON DELETE CASCADE;
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "Vm"("id") ON DELETE SET NULL;
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "Vm"("id") ON DELETE CASCADE;
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "Vm"("id") ON DELETE CASCADE;
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "Vm"("id") ON DELETE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Task" ADD CONSTRAINT "Task_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "Vm"("id") ON DELETE SET NULL;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE;

-- Compound uniques & indexes (from @@unique / @@index in schema.prisma)
CREATE UNIQUE INDEX "Node_clusterId_name_key" ON "Node"("clusterId", "name");
CREATE UNIQUE INDEX "Vm_clusterId_vmid_key" ON "Vm"("clusterId", "vmid");
CREATE UNIQUE INDEX "IpAddress_poolId_ip_key" ON "IpAddress"("poolId", "ip");
CREATE UNIQUE INDEX "Snapshot_vmId_name_key" ON "Snapshot"("vmId", "name");
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");
CREATE INDEX "Vm_ownerId_status_idx" ON "Vm"("ownerId", "status");
CREATE INDEX "Vm_deletedAt_idx" ON "Vm"("deletedAt");
CREATE INDEX "Task_userId_createdAt_idx" ON "Task"("userId", "createdAt");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "IpAddress_status_idx" ON "IpAddress"("status");
