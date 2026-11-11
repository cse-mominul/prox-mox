import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errMsg, setToken } from '../../lib/api';
import { Button, Card, Badge, Input, Select, EmptyState, Modal, useToast } from '../../components/ui/ui';

export function ClustersPage() {
  const qc = useQueryClient(); const { toast } = useToast(); const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', host: '', port: 8006, tokenId: '', tokenSecret: '', verifyTls: false });
  const { data, isLoading } = useQuery({ queryKey: ['clusters'], queryFn: async () => (await api.get('/clusters')).data });
  const create = async () => { try { await api.post('/clusters', f); toast('Cluster added'); setOpen(false); qc.invalidateQueries({ queryKey: ['clusters'] }); } catch (e) { toast(errMsg(e), false); } };
  const test = async (id: string) => { try { const r = await api.post(`/clusters/${id}/test`); toast(`Connected: Proxmox ${r.data.version?.version || ''}`); qc.invalidateQueries({ queryKey: ['clusters'] }); } catch (e) { toast(errMsg(e), false); } };
  const del = async (id: string) => { if (!confirm('Remove cluster?')) return; await api.delete(`/clusters/${id}`); qc.invalidateQueries({ queryKey: ['clusters'] }); };
  const list = Array.isArray(data) ? data : [];
  return <div className="space-y-4"><div className="flex justify-between"><h1 className="text-2xl font-bold">Clusters</h1><Button onClick={() => setOpen(true)}>+ Add cluster</Button></div>
    {isLoading ? <p>Loading…</p> : list.length === 0 ? <Card><EmptyState title="No clusters" hint="Add your first Proxmox VE cluster with an API token." /></Card> : list.map((c: any) => <Card key={c.id} className="p-4 flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{c.name}</p><p className="text-sm text-zinc-500">{c.host}:{c.port} · token {c.tokenId} · TLS verify {c.verifyTls ? 'on' : 'off (self-signed ok)'} · {c._count?.vms || 0} VMs {c.lastError && <span className="text-red-600">· {c.lastError}</span>}</p><p className="text-sm text-zinc-500">{(c.nodes || []).map((n: any) => `${n.name}:${n.status}`).join(' · ') || 'Not synced yet'}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => test(c.id)}>Test connection</Button><Button variant="danger" onClick={() => del(c.id)}>Remove</Button></div></Card>)}
    <Modal open={open} title="Add Proxmox cluster" onClose={() => setOpen(false)}><div className="space-y-3">
      <Input placeholder="Name e.g. prod-eu" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input placeholder="Host IP/hostname" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />
      <Input type="number" placeholder="Port" value={f.port} onChange={(e) => setF({ ...f, port: Number(e.target.value) })} />
      <Input placeholder="Token ID e.g. root@pam!portal" value={f.tokenId} onChange={(e) => setF({ ...f, tokenId: e.target.value })} />
      <Input type="password" placeholder="Token secret (encrypted at rest)" value={f.tokenSecret} onChange={(e) => setF({ ...f, tokenSecret: e.target.value })} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.verifyTls} onChange={(e) => setF({ ...f, verifyTls: e.target.checked })} /> Verify TLS (off for self-signed certs)</label>
      <Button className="w-full" onClick={create}>Add cluster</Button></div></Modal>
  </div>;
}
export function UsersPage() {
  const qc = useQueryClient(); const { toast } = useToast(); const [search, setSearch] = useState(''); const [quotaFor, setQuotaFor] = useState<any>(null);
  const [q, setQ] = useState({ maxVms: 3, maxVCpu: 8, maxRamMb: 16384, maxDiskGb: 200, maxSnapshots: 10, maxBackups: 10, maxIps: 3 });
  const { data } = useQuery({ queryKey: ['users', search], queryFn: async () => (await api.get('/users', { params: { search, limit: 50 } })).data });
  const act = async (id: string, a: string) => { try { await api.post(`/users/${id}/${a}`); qc.invalidateQueries({ queryKey: ['users'] }); toast('Done'); } catch (e) { toast(errMsg(e), false); } };
  const impersonate = async (id: string) => { if (!confirm('Impersonate this user? This is audit-logged.')) return; const r = await api.post(`/users/${id}/impersonate`); setToken(r.data.accessToken); location.href = '/'; };
  const list = data?.data || [];
  return <div className="space-y-4"><div className="flex justify-between flex-wrap gap-3"><h1 className="text-2xl font-bold">Users</h1><div className="flex gap-2"><Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} /><a href="/api/v1/users/export.csv"><Button variant="outline">Export CSV</Button></a></div></div>
    <Card className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-zinc-500 border-b"><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">VMs</th><th className="p-3">Actions</th></tr></thead>
    <tbody>{list.map((u: any) => <tr key={u.id} className="border-b"><td className="p-3"><b>{u.name}</b><br /><span className="text-zinc-500">{u.email}</span></td><td className="p-3"><Badge>{u.role}</Badge></td><td className="p-3"><Badge tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge></td><td className="p-3">{u._count?.vms || 0}</td>
      <td className="p-3"><div className="flex gap-1.5 flex-wrap"><Button variant="outline" onClick={() => { setQuotaFor(u); setQ(u.quota || q); }}>Quota</Button>{u.status === 'ACTIVE' ? <Button variant="outline" onClick={() => act(u.id, 'suspend')}>Suspend</Button> : <Button variant="outline" onClick={() => act(u.id, 'unsuspend')}>Unsuspend</Button>}<Button variant="outline" onClick={() => impersonate(u.id)}>Login as</Button></div></td></tr>)}</tbody></table>
    {list.length === 0 && <EmptyState title="No users" />}</Card>
    <Modal open={!!quotaFor} title={`Quota — ${quotaFor?.email || ''}`} onClose={() => setQuotaFor(null)}><div className="grid grid-cols-2 gap-3">
      {Object.keys(q).map((k) => <div key={k}><label className="text-xs text-zinc-500">{k}</label><Input type="number" value={(q as any)[k]} onChange={(e) => setQ({ ...q, [k]: Number(e.target.value) })} /></div>)}
      <Button className="col-span-2" onClick={async () => { await api.patch(`/users/${quotaFor.id}/quota`, q); toast('Quota saved'); setQuotaFor(null); qc.invalidateQueries({ queryKey: ['users'] }); }}>Save quota</Button></div></Modal>
  </div>;
}
export function PlansPage() {
  const qc = useQueryClient(); const [f, setF] = useState({ name: '', description: '', vcpu: 2, ramMb: 2048, diskGb: 40, priceMonthly: 10 });
  const { data } = useQuery({ queryKey: ['plans-all'], queryFn: async () => (await api.get('/plans/all')).data });
  const list = Array.isArray(data) ? data : [];
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Plans</h1>
    <Card className="p-4 flex flex-wrap gap-2"><Input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="max-w-[160px]" /><Input type="number" placeholder="vCPU" value={f.vcpu} onChange={(e) => setF({ ...f, vcpu: Number(e.target.value) })} className="max-w-[100px]" /><Input type="number" placeholder="RAM MB" value={f.ramMb} onChange={(e) => setF({ ...f, ramMb: Number(e.target.value) })} className="max-w-[110px]" /><Input type="number" placeholder="Disk GB" value={f.diskGb} onChange={(e) => setF({ ...f, diskGb: Number(e.target.value) })} className="max-w-[100px]" /><Input type="number" placeholder="$/mo" value={f.priceMonthly} onChange={(e) => setF({ ...f, priceMonthly: Number(e.target.value) })} className="max-w-[100px]" /><Button onClick={async () => { await api.post('/plans', f); qc.invalidateQueries({ queryKey: ['plans-all'] }); }}>Add plan</Button></Card>
    <div className="grid gap-3 md:grid-cols-3">{list.map((p: any) => <Card key={p.id} className="p-4"><p className="font-bold">{p.name}</p><p className="text-sm text-zinc-500">{p.vcpu} vCPU · {(p.ramMb / 1024).toFixed(0)} GB RAM · {p.diskGb} GB · ${p.priceMonthly}/mo</p><Button variant="danger" className="mt-3" onClick={async () => { await api.delete(`/plans/${p.id}`); qc.invalidateQueries({ queryKey: ['plans-all'] }); }}>Delete</Button></Card>)}</div>
  </div>;
}
export function IpamPage() {
  const qc = useQueryClient(); const { toast } = useToast(); const [f, setF] = useState({ name: '', gateway: '', range: '', bridge: 'vmbr0' });
  const { data } = useQuery({ queryKey: ['pools'], queryFn: async () => (await api.get('/ip-pools')).data });
  const list = Array.isArray(data) ? data : [];
  return <div className="space-y-4"><h1 className="text-2xl font-bold">IP Pools (IPAM)</h1>
    <Card className="p-4 flex flex-wrap gap-2"><Input placeholder="Pool name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="max-w-[160px]" /><Input placeholder="Range 203.0.113.10-203.0.113.50" value={f.range} onChange={(e) => setF({ ...f, range: e.target.value })} className="max-w-[260px]" /><Input placeholder="Gateway" value={f.gateway} onChange={(e) => setF({ ...f, gateway: e.target.value })} className="max-w-[150px]" /><Button onClick={async () => { try { await api.post('/ip-pools', f); toast('Pool created'); qc.invalidateQueries({ queryKey: ['pools'] }); } catch (e) { toast(errMsg(e), false); } }}>Create pool</Button></Card>
    {list.map((p: any) => <Card key={p.id} className="p-4 flex justify-between"><span><b>{p.name}</b> <span className="text-zinc-500 text-sm">{p.bridge} · gw {p.gateway} · {p._count?.addresses || 0} addresses · {(p.addresses || []).filter((a: any) => a.status === 'ASSIGNED').length} assigned</span></span><Button variant="danger" onClick={async () => { await api.delete(`/ip-pools/${p.id}`); qc.invalidateQueries({ queryKey: ['pools'] }); }}>Delete</Button></Card>)}
  </div>;
}
export function AuditPage() {
  const [action, setAction] = useState('');
  const { data } = useQuery({ queryKey: ['audit', action], queryFn: async () => (await api.get('/audit', { params: { action, limit: 50 } })).data });
  const list = data?.data || [];
  return <div className="space-y-4"><div className="flex justify-between"><h1 className="text-2xl font-bold">Audit Log</h1><a href="/api/v1/audit/export.csv"><Button variant="outline">Export CSV</Button></a></div>
    <Input placeholder="Filter action e.g. vm.create" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-sm" />
    <Card className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-zinc-500 border-b"><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">IP</th></tr></thead><tbody>{list.map((r: any) => <tr key={r.id} className="border-b"><td className="p-3">{new Date(r.createdAt).toLocaleString()}</td><td className="p-3">{r.actor?.email || '—'}</td><td className="p-3 font-medium">{r.action}</td><td className="p-3">{r.entity} {r.entityId?.slice(0, 8)}</td><td className="p-3">{r.ip || '—'}</td></tr>)}</tbody></table>{list.length === 0 && <EmptyState title="No audit entries" />}</Card>
  </div>;
}
export function SettingsPage() {
  const { toast } = useToast(); const { data } = useQuery({ queryKey: ['settings'], queryFn: async () => (await api.get('/settings')).data });
  const [name, setName] = useState(''); const [reg, setReg] = useState(true); const [maint, setMaint] = useState(false);
  const save = async () => { try { await api.put('/settings', { site_name: name || data?.site_name, registration_enabled: reg, maintenance_mode: maint }); toast('Settings saved'); } catch (e) { toast(errMsg(e), false); } };
  return <div className="space-y-4 max-w-xl"><h1 className="text-2xl font-bold">System Settings</h1><Card className="p-5 space-y-4">
    <div><label className="text-sm font-medium">Site name / branding</label><Input placeholder={data?.site_name || 'Proxmox Portal'} value={name} onChange={(e) => setName(e.target.value)} /></div>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={reg} onChange={(e) => setReg(e.target.checked)} /> Registration enabled</label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={maint} onChange={(e) => setMaint(e.target.checked)} /> Maintenance mode</label>
    <p className="text-sm text-zinc-500">SMTP is configured via environment (SMTP_HOST/PORT/USER/PASS) — see .env.example. Current keys: {data ? Object.keys(data).join(', ') : '…'}</p>
    <Button onClick={save}>Save settings</Button></Card></div>;
}
