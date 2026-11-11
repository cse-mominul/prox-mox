# Proxmox VE Management Portal

A production-ready, multi-cluster **Proxmox VE hosting / VPS control panel** — a mini hosting panel that talks to one or more Proxmox VE clusters through the official Proxmox REST API.

**Stack choice: NestJS (TypeScript) backend** — one language across the stack, first-class Swagger, guards for RBAC, and BullMQ for durable Proxmox task (UPID) polling. Frontend: React + TypeScript + Vite + Tailwind CSS (shadcn/ui-style components), React Query, React Router. PostgreSQL via Prisma, Redis for queue/rate-limiting.

![stack](https://img.shields.io/badge/backend-NestJS%20%2B%20Prisma-orange) ![frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-blue) ![db](https://img.shields.io/badge/db-PostgreSQL%20%2B%20Redis-green)

---

## 1. Architecture & folder structure

```
prox-mox/
├── docker-compose.yml        # postgres, redis, backend, worker, frontend, nginx (HTTPS)
├── .env.example              # copy to .env — all secrets live here, never in code
├── nginx/nginx.conf          # reverse proxy (SPA + /api, SSE-friendly, WS upgrade)
├── backend/                  # NestJS API (port 3000, prefix /api/v1, Swagger /api/docs)
│   ├── prisma/
│   │   ├── schema.prisma           # users, quotas, sessions, api_keys, clusters, nodes,
│   │   │                           # vms, plans, ip_pools, ip_addresses, snapshots, backups,
│   │   │                           # tasks (UPID), audit_logs, notifications, tickets, settings
│   │   ├── migrations/             # initial SQL migration (indexes + FKs)
│   │   └── seed.ts                 # first SUPER_ADMIN + Basic/Pro/Business plans
│   ├── src/
│   │   ├── proxmox/    # ProxmoxService: token auth, TLS toggle, retries, timeout,
│   │   │               # error mapping, UPID polling, rrddata, vnc/term proxy tickets
│   │   ├── auth/       # register/login/refresh/logout, email verify, reset, 2FA TOTP,
│   │   │               # lockout, login-attempt log, sessions, JwtAuthGuard (JWT + API keys)
│   │   ├── users/      # CRUD, quotas + assertQuota, suspend, impersonate, CSV export
│   │   ├── clusters/   # multi-cluster CRUD, encrypted token, test-connection, node sync
│   │   ├── vms/        # create wizard logic (clone/create, least-loaded node, IPAM),
│   │   │               # lifecycle, resize (grow-only), snapshots, vzdump backups,
│   │   │               # metrics, console tickets, firewall, soft-delete + 24h restore
│   │   ├── tasks/      # Task rows + SSE stream (/tasks/stream)
│   │   ├── queue/      # BullMQ queue + TaskProcessor (UPID polling; in-process fallback)
│   │   ├── ipam/ plans/ tickets/ api-keys/ notifications/ audit/ settings/ admin/
│   │   ├── common/     # AES-256-GCM crypto, RolesGuard + permission map, error filter
│   │   ├── main.ts     # helmet, strict CORS, validation pipe, Swagger
│   │   └── worker.ts   # BullMQ worker entrypoint (docker `worker` service)
│   └── test/           # jest: auth, quota check, VM create with mocked Proxmox API
└── frontend/                 # React SPA
    └── src/
        ├── lib/        # axios client (refresh-cookie flow), auth context
        ├── components/ # Layout (sidebar, dark/light), shadcn-style UI, toasts, modals
        └── pages/      # auth, Dashboard, My VMs, Create wizard, VM detail (tabs:
                        # Overview/Console/Metrics/Snapshots/Backups/Network/Firewall/
                        # Settings), Tasks, Tickets, Profile/Security, admin pages
```

**Request flow for a long Proxmox operation** (e.g. create VM):
`POST /api/v1/vms` → quota validated → Proxmox returns a UPID → a `Task` row is created and a BullMQ job enqueues UPID polling → worker polls `/nodes/{node}/tasks/{upid}/status` until `stopped`, mirroring progress/log into the Task row and fanning out over SSE → frontend shows `queued → running → success/failed` with logs. If Redis is down, polling falls back to in-process so dev still works.

## 2. Quick start (Docker — recommended)

```bash
git clone https://github.com/cse-mominul/prox-mox.git && cd prox-mox
cp .env.example .env
# edit .env: set JWT secrets, ENCRYPTION_KEY (openssl rand -hex 32), SUPER_ADMIN_*
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed   # creates SUPER_ADMIN from .env
```
Open `https://<your-host>` (nginx) or `http://localhost` — sign in with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`, then **Admin → Clusters → Add cluster → Test connection**.

### Local dev (without Docker)
```bash
# Postgres + Redis required (e.g. docker compose up postgres redis)
cd backend && cp ../.env.example .env && npm install
npx prisma migrate dev && npm run seed && npm run start:dev   # API :3000, docs /api/docs
cd ../frontend && npm install && npm run dev                  # SPA :5173, /api proxied
cd ../backend && npm test                                     # auth / quota / VM-create tests
```

## 3. Creating a Proxmox API token (required permissions)

In Proxmox VE (Datacenter → Permissions → API Tokens, or CLI):

```bash
# Dedicated least-privilege user (do NOT use root's token long-term)
pveum user add portal@pve --comment "Management Portal"
pveum user token add portal@pve portal --privsep 0   # note the secret — shown once!
pveum acl modify / --users portal@pve --roles PVEVMAdmin
pveum acl modify /storage --users portal@pve --roles PVEDatastoreAdmin
# Optional narrower alternative to PVEDatastoreAdmin: PVEDatastoreUser + PVEDatastoreAllocate on specific storages
```
You need: **PVEVMAdmin** (VM lifecycle, config, snapshots, console, firewall), **PVEDatastoreAdmin/User** (ISO/template lists, backups, uploads), **PVESysAdmin** only if you manage node networks/bridges, **PVEVMUser** is *not* sufficient for provisioning. With privilege separation (`--privsep 1`), grant the same ACLs to the token itself. Then in the portal: token ID = `portal@pve!portal`, paste the secret — it is stored **AES-256-GCM encrypted** and never sent to the browser.

> Self-signed Proxmox certs: leave **Verify TLS off** when adding the cluster (default). Turn it on only with a publicly trusted / properly chained cert on :8006.

## 4. Adding a cluster
Admin → **Clusters → Add cluster** (name, host/IP, port 8006, token ID + secret, TLS toggle) → **Test connection** syncs nodes and shows CPU/RAM. Repeat for more clusters — VMs, IP pools and the create wizard are cluster-aware, and "auto-select node" picks the least-loaded online node.

## 5. Features checklist
- **Auth:** register (admin-toggleable), email verification, login/logout, refresh-token rotation (httpOnly cookie), forgot/reset, change password, TOTP 2FA + backup codes, brute-force lockout (5 fails / 15 min) + login-attempt logs, session/device list & revoke, personal API keys (`pk_…`, hashed, scoped, revocable) usable as Bearer tokens.
- **RBAC:** `SUPER_ADMIN / ADMIN / RESELLER / USER` with permission-based `RolesGuard` on every admin endpoint; **ownership check on every VM action** (users only touch their own VMs).
- **Users (admin):** create/edit/suspend/delete, role & password reset, per-user quotas (VMs, vCPU, RAM, disk, snapshots, backups, IPs) enforced before provisioning, VM transfer, audited impersonation, search/filter/pagination, CSV export.
- **VMs:** wizard (cluster → node/auto → template-clone or ISO → plan sizing → bridge/VLAN/static/DHCP/IPAM → password/SSH-key/cloud-init), next-free VMID, start/stop/shutdown/reboot/reset/suspend/resume, grow-only disk resize, ISO mount, snapshots, vzdump backups + schedules + restore, rrddata metrics (1h/1d/1w charts), noVNC/xterm console tickets, per-VM firewall, reinstall, password reset, type-to-confirm soft-delete with 24h restore window (hard purge via `POST /admin/purge-expired-vms` on a cron).
- **Admin:** dashboard (users, VM counts, live cluster CPU/RAM/storage, recent tasks, failure alerts), node/storage/template/ISO views, IPAM pools, plans, audit log (who/what/IP, CSV export), settings (branding, registration, maintenance, default quotas), email + in-app notifications.
- **Security:** argon2id hashing, parameterized Prisma queries, strict CORS + helmet, per-IP/user throttling (120/min global, stricter on auth), consistent `{statusCode, error, message, path, timestamp}` errors, audit logging, secrets only in env, Proxmox token encrypted at rest.

## 6. API
Versioned REST under `/api/v1`, interactive docs at **`/api/docs`** (Swagger/OpenAPI, Bearer auth). Every mutating VM operation returns `{ taskId, upid }`; poll `GET /tasks/:id` or subscribe to `GET /tasks/stream` (SSE).

## 7. Production deployment notes
- Put real certs in `./certs` and enable the HTTPS server block in `nginx/nginx.conf`; set strong `JWT_*`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD` in `.env` (never commit it).
- Scale workers with `docker compose up -d --scale worker=3`; run `POST /api/v1/admin/purge-expired-vms` + backup-schedule execution from your cron of choice.
- Back up Postgres (`pgdata` volume) — it holds encrypted Proxmox secrets; losing `ENCRYPTION_KEY` makes stored tokens unrecoverable.

## 8. Tests
```bash
cd backend && npm test   # auth flow, quota enforcement, VM create with mocked Proxmox API
```
