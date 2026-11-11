import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, errMsg } from '../../lib/api';
import { Button, Card, Badge, Input, Select, useToast, Modal } from '../../components/ui/ui';
import { VmStatusBadge, DeleteVmModal } from './VmsPages';

const TABS = ['Overview', 'Console', 'Metrics', 'Snapshots', 'Backups', 'Network', 'Firewall', 'Settings'] as const;
export default function VmDetailPage() {
  const { id } = useParams(); const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const { toast } = useToast(); const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['vm', id], queryFn: async () => (await api.get(`/vms/${id}`)).data, refetchInterval: 15000 });
  const vm = data?.vm; const live = data?.live;
  const act = async (a: string) => { try { const r = await api.post(`/vms/${id}/${a}`); toast(`Task ${r.data.taskId} queued`); qc.invalidateQueries({ queryKey: ['vm', id] }); } catch (e) { toast(errMsg(e), false); } };
  if (isLoading) return <p className="text-zinc-500">Loading VM…</p>;
  if (!vm) return <p>VM not found.</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{vm.name}</h1><p className="text-sm text-zinc-500">#{vm.vmid} · {vm.type} · {vm.node} · {vm.clusterId?.slice(0, 8)}…</p></div>
      <div className="flex gap-2 items-center"><VmStatusBadge s={vm.status} />
        <Button onClick={() => act('start')}>Start</Button><Button variant="outline" onClick={() => act('shutdown')}>Shutdown</Button><Button variant="outline" onClick={() => act('reboot')}>Reboot</Button><Button variant="outline" onClick={() => act('reset')}>Reset</Button><Button variant="danger" onClick={() => act('stop')}>Stop</Button>
      </div>
    </div>
    <div className="flex gap-1.5 flex-wrap border-b">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm rounded-t ${tab === t ? 'bg-white dark:bg-zinc-900 border border-b-0 font-medium' : 'text-zinc-500'}`}>{t}</button>)}</div>
    {tab === 'Overview' && <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-4"><h3 className="font-semibold mb-2">Resources</h3><p className="text-sm text-zinc-500">{vm.vcpu} vCPU · {(vm.ramMb / 1024).toFixed(1)} GB RAM · {vm.diskGb} GB disk on {vm.storage}</p>{live && <p className="text-sm mt-2">Live: CPU {Math.round((live.cpu || 0) * 100)}% · RAM {live.maxmem ? Math.round((live.mem / live.maxmem) * 100) : 0}% · Uptime {Math.round((live.uptime || 0) / 3600)}h</p>}</Card>
      <Card className="p-4"><h3 className="font-semibold mb-2">Network</h3><p className="text-sm text-zinc-500">Bridge {vm.bridge}{vm.vlan ? ` · VLAN ${vm.vlan}` : ''}<br />IP: {vm.ipAddress || '—'}</p></Card>
      <Card className="p-4"><h3 className="font-semibold mb-2">Guest</h3><p className="text-sm text-zinc-500">Hostname: {vm.hostname || vm.name}<br />Tags: {(vm.tags || []).join(', ') || '—'}</p></Card>
    </div>}
    {tab === 'Console' && <ConsoleTab vm={vm} />}
    {tab === 'Metrics' && <MetricsTab id={id!} />}
    {tab === 'Snapshots' && <SnapshotsTab id={id!} />}
    {tab === 'Backups' && <BackupsTab id={id!} />}
    {tab === 'Network' && <Card className="p-4 text-sm text-zinc-500">Bridge {vm.bridge} · IP {vm.ipAddress || 'DHCP'} · Manage addresses in Admin → IP Pools. Use Settings tab for ISO mount.</Card>}
    {tab === 'Firewall' && <FirewallTab id={id!} />}
    {tab === 'Settings' && <SettingsTab vm={vm} />}
  </div>;
}
function ConsoleTab({ vm }: { vm: any }) {
  const [ticket, setTicket] = useState<any>(null); const { toast } = useToast();
  const open = async () => { try { setTicket((await api.get(`/vms/${vm.id}/console`)).data); } catch (e) { toast(errMsg(e), false); } };
  return <Card className="p-4 space-y-3">
    <p className="text-sm text-zinc-500">Web console ({vm.type === 'LXC' ? 'xterm.js' : 'noVNC'}). The backend issues a one-time Proxmox ticket; connect your noVNC/xterm client to the websocket URL below (ticket never exposes the cluster token).</p>
    <Button onClick={open}>Open console session</Button>
    {ticket && <div className="rounded-lg bg-zinc-950 text-green-400 p-4 font-mono text-xs overflow-x-auto">
      <p>type={ticket.type} node={ticket.node} vmid={ticket.vmid} port={ticket.port}</p>
      <p className="break-all">wss: /nodes/{ticket.node}/{vm.type === 'LXC' ? 'lxc' : 'qemu'}/{ticket.vmid}/vncwebsocket?port={ticket.port}&amp;vncticket={encodeURIComponent(ticket.ticket || '')}</p>
      <p className="text-zinc-400 mt-2">In production, load @novnc/novnc RFB against that websocket through the nginx /api proxy; for LXC use xterm.js with termproxy ticket similarly.</p>
    </div>}
  </Card>;
}
function MetricsTab({ id }: { id: string }) {
  const [tf, setTf] = useState('hour');
  const { data } = useQuery({ queryKey: ['metrics', id, tf], queryFn: async () => (await api.get(`/vms/${id}/metrics`, { params: { timeframe: tf } })).data, refetchInterval: 30000 });
  const rows = (Array.isArray(data) ? data : []).map((r: any) => ({ t: new Date((r.time || 0) * 1000).toLocaleTimeString(), cpu: Math.round((r.cpu || 0) * 100), mem: r.maxmem ? Math.round((r.mem / r.maxmem) * 100) : 0, net: Math.round(((r.netin || 0) + (r.netout || 0)) / 1024), disk: Math.round(((r.diskread || 0) + (r.diskwrite || 0)) / 1024 / 1024) }));
  return <Card className="p-4"><div className="flex gap-2 mb-3">{['hour', 'day', 'week'].map((t) => <Button key={t} variant={tf === t ? 'default' : 'outline'} onClick={() => setTf(t)}>{t === 'hour' ? '1h' : t === 'day' ? '1d' : '1w'}</Button>)}</div>
    {rows.length === 0 ? <p className="text-sm text-zinc-500">No metrics yet (VM off or cluster unreachable).</p> : <ResponsiveContainer width="100%" height={260}><LineChart data={rows}><XAxis dataKey="t" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="cpu" stroke="#e57000" name="CPU %" dot={false} /><Line type="monotone" dataKey="mem" stroke="#2563eb" name="RAM %" dot={false} /><Line type="monotone" dataKey="net" stroke="#16a34a" name="Net KB/s" dot={false} /></LineChart></ResponsiveContainer>}
  </Card>;
}
function SnapshotsTab({ id }: { id: string }) {
  const [name, setName] = useState(''); const { toast } = useToast(); const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['snaps', id], queryFn: async () => (await api.get(`/vms/${id}/snapshots`)).data });
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); qc.invalidateQueries({ queryKey: ['snaps', id] }); } catch (e) { toast(errMsg(e), false); } };
  const list = Array.isArray(data) ? data : [];
  return <Card className="p-4 space-y-3"><div className="flex gap-2"><Input placeholder="Snapshot name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" /><Button disabled={!name} onClick={() => run(() => api.post(`/vms/${id}/snapshots`, { name }), 'Snapshot task queued')}>Create snapshot</Button></div>
    {list.length === 0 ? <p className="text-sm text-zinc-500">No snapshots.</p> : list.map((s: any) => <div key={s.name} className="flex justify-between border rounded-lg p-3"><span className="font-medium">{s.name} <span className="text-zinc-400 text-sm">{s.description || ''}</span></span><span className="flex gap-2"><Button variant="outline" onClick={() => run(() => api.post(`/vms/${id}/snapshots/${encodeURIComponent(s.name)}/rollback`), 'Rollback queued')}>Rollback</Button><Button variant="danger" onClick={() => run(() => api.delete(`/vms/${id}/snapshots/${encodeURIComponent(s.name)}`), 'Delete queued')}>Delete</Button></span></div>)}
  </Card>;
}
function BackupsTab({ id }: { id: string }) {
  const { toast } = useToast(); const qc = useQueryClient(); const [cron, setCron] = useState('0 3 * * *');
  const { data } = useQuery({ queryKey: ['backups', id], queryFn: async () => (await api.get(`/vms/${id}/backups`)).data });
  const create = async () => { try { await api.post(`/vms/${id}/backups`, { storage: 'local', mode: 'SNAPSHOT' }); toast('Backup task queued'); qc.invalidateQueries({ queryKey: ['backups', id] }); } catch (e) { toast(errMsg(e), false); } };
  const schedule = async () => { try { await api.post(`/vms/${id}/backup-schedules`, { cron, storage: 'local' }); toast('Schedule saved'); } catch (e) { toast(errMsg(e), false); } };
  const list = Array.isArray(data) ? data : [];
  return <Card className="p-4 space-y-3"><div className="flex gap-2 flex-wrap"><Button onClick={create}>Backup now</Button><Input value={cron} onChange={(e) => setCron(e.target.value)} className="max-w-[180px]" aria-label="Cron schedule" /><Button variant="outline" onClick={schedule}>Save schedule</Button></div>
    {list.length === 0 ? <p className="text-sm text-zinc-500">No backups recorded.</p> : list.map((b: any) => <div key={b.id} className="flex justify-between border rounded-lg p-3 text-sm"><span>{b.storage} · {b.mode} · {new Date(b.createdAt).toLocaleString()} {b.volid || ''}</span><Button variant="danger" onClick={async () => { await api.delete(`/vms/${id}/backups/${b.id}`); qc.invalidateQueries({ queryKey: ['backups', id] }); }}>Delete</Button></div>)}
    <p className="text-xs text-zinc-400">Download: fetch the backup volid from storage content via cluster storage API; large downloads are proxied by storage, not stored in Postgres.</p>
  </Card>;
}
function FirewallTab({ id }: { id: string }) {
  const { toast } = useToast(); const qc = useQueryClient(); const [f, setF] = useState({ action: 'ACCEPT', dir: 'in', proto: 'tcp', dport: '22', source: '' });
  const { data } = useQuery({ queryKey: ['fw', id], queryFn: async () => (await api.get(`/vms/${id}/firewall`)).data });
  const add = async () => { try { await api.post(`/vms/${id}/firewall`, f); toast('Rule added'); qc.invalidateQueries({ queryKey: ['fw', id] }); } catch (e) { toast(errMsg(e), false); } };
  const list = Array.isArray(data) ? data : [];
  return <Card className="p-4 space-y-3"><div className="flex gap-2 flex-wrap"><Select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} className="max-w-[130px]"><option>ACCEPT</option><option>DROP</option><option>REJECT</option></Select><Input placeholder="proto" value={f.proto} onChange={(e) => setF({ ...f, proto: e.target.value })} className="max-w-[100px]" /><Input placeholder="port" value={f.dport} onChange={(e) => setF({ ...f, dport: e.target.value })} className="max-w-[100px]" /><Input placeholder="source CIDR" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className="max-w-[160px]" /><Button onClick={add}>Add rule</Button></div>
    {list.length === 0 ? <p className="text-sm text-zinc-500">No rules.</p> : list.map((r: any, i: number) => <div key={r.id || i} className="border rounded-lg p-3 text-sm flex justify-between"><span>{r.action} {r.dir || r.type} {r.proto || ''}/{r.dport || ''} from {r.source || 'any'}</span>{r.id && <Button variant="danger" onClick={async () => { await api.delete(`/vms/${id}/firewall/${r.id}`); qc.invalidateQueries({ queryKey: ['fw', id] }); }}>Delete</Button>}</div>)}
  </Card>;
}
function SettingsTab({ vm }: { vm: any }) {
  const { toast } = useToast(); const [del, setDel] = useState(false); const [iso, setIso] = useState(''); const [f, setF] = useState({ vcpu: vm.vcpu, ramMb: vm.ramMb, diskGb: vm.diskGb });
  const save = async () => { try { await api.patch(`/vms/${vm.id}`, f); toast('Settings saved (disk grow-only)'); } catch (e) { toast(errMsg(e), false); } };
  return <Card className="p-4 space-y-4">
    <div className="grid grid-cols-3 gap-3"><div><label className="text-sm">vCPU</label><Input type="number" value={f.vcpu} onChange={(e) => setF({ ...f, vcpu: Number(e.target.value) })} /></div><div><label className="text-sm">RAM MB</label><Input type="number" value={f.ramMb} onChange={(e) => setF({ ...f, ramMb: Number(e.target.value) })} /></div><div><label className="text-sm">Disk GB (grow only)</label><Input type="number" value={f.diskGb} onChange={(e) => setF({ ...f, diskGb: Number(e.target.value) })} /></div></div>
    <Button onClick={save}>Save resize</Button>
    <div className="flex gap-2"><Input placeholder="ISO volid (blank unmounts on save with empty)" value={iso} onChange={(e) => setIso(e.target.value)} /><Button variant="outline" onClick={async () => { await api.post(`/vms/${vm.id}/iso`, { iso }); toast(iso ? 'ISO mounted' : 'ISO unmounted'); }}>Mount / unmount ISO</Button></div>
    <div className="border-t pt-4"><p className="text-sm font-medium text-red-600">Danger zone</p><Button variant="danger" className="mt-2" onClick={() => setDel(true)}>Delete VM</Button></div>
    <DeleteVmModal vm={vm} onClose={() => setDel(false)} />
    {del && <Modal open title="" onClose={() => setDel(false)}><p /></Modal>}
  </Card>;
}
