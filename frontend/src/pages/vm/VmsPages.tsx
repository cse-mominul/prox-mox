import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { Button, Card, Badge, Input, Select, EmptyState, Skeleton, Modal, useToast } from '../../components/ui/ui';

export function VmStatusBadge({ s }: { s: string }) { return <Badge tone={s === 'RUNNING' ? 'green' : s === 'DELETED' ? 'red' : 'zinc'}>{s}</Badge>; }
async function vmAction(id: string, a: string) { return (await api.post(`/vms/${id}/${a}`)).data; }

export function VmsListPage() {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['vms', search, status], queryFn: async () => (await api.get('/vms', { params: { search, status, limit: 50 } })).data });
  const { toast } = useToast(); const qc = useQueryClient();
  const act = async (id: string, a: string) => { try { await vmAction(id, a); toast(`Task queued: ${a}`); qc.invalidateQueries({ queryKey: ['vms'] }); } catch (e) { toast(errMsg(e), false); } };
  const list = data?.data || [];
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3 items-center justify-between"><h1 className="text-2xl font-bold">Virtual Machines</h1><Link to="/vms/new"><Button>+ Create VM</Button></Link></div>
    <div className="flex gap-3"><Input placeholder="Search VMs…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" /><Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]"><option value="">All statuses</option><option>RUNNING</option><option>STOPPED</option></Select></div>
    {isLoading ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : list.length === 0 ? <Card><EmptyState title="No VMs found" hint="Create a VM from a template or ISO." action={<Link to="/vms/new"><Button>Create VM</Button></Link>} /></Card> :
    <div className="grid gap-3">{list.map((v: any) => <Card key={v.id} className="p-4 flex flex-wrap gap-3 items-center justify-between">
      <div><Link to={`/vms/${v.id}`} className="font-semibold hover:text-orange-600">{v.name}</Link><p className="text-sm text-zinc-500">#{v.vmid} · {v.type} · {v.node} · {v.vcpu} vCPU · {(v.ramMb / 1024).toFixed(1)} GB RAM · {v.diskGb} GB · {v.ipAddress || 'no IP'}</p></div>
      <div className="flex items-center gap-2"><VmStatusBadge s={v.status} />
        {v.status === 'RUNNING' ? <><Button variant="outline" onClick={() => act(v.id, 'shutdown')}>Shutdown</Button><Button variant="outline" onClick={() => act(v.id, 'reboot')}>Reboot</Button><Button variant="danger" onClick={() => act(v.id, 'stop')}>Stop</Button></> : <Button onClick={() => act(v.id, 'start')}>Start</Button>}
      </div></Card>)}</div>}
  </div>;
}

/** Create wizard: cluster → node (auto least-loaded) → template/ISO → sizing → network → cloud-init. */
export function VmCreatePage() {
  const nav = useNavigate(); const { toast } = useToast(); const [step, setStep] = useState(0); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ clusterId: '', node: '', type: 'QEMU', name: '', planId: '', cloneFromVmid: '', iso: '', vcpu: 2, ramMb: 2048, diskGb: 20, storage: 'local-lvm', bridge: 'vmbr0', vlan: '', ip: '', ipPoolId: '', rootPassword: '', sshKey: '', cloudInit: true });
  const clusters = useQuery({ queryKey: ['clusters'], queryFn: async () => (await api.get('/clusters')).data });
  const plans = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/plans')).data });
  const nodes = useQuery({ queryKey: ['nodes', f.clusterId], queryFn: async () => (await api.get(`/clusters/${f.clusterId}/nodes`)).data, enabled: !!f.clusterId });
  const pools = useQuery({ queryKey: ['pools'], queryFn: async () => (await api.get('/ip-pools')).data });
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { clusterId: f.clusterId, node: f.node || undefined, type: f.type, name: f.name, planId: f.planId || undefined, cloneFromVmid: f.cloneFromVmid ? Number(f.cloneFromVmid) : undefined, iso: f.iso || undefined, vcpu: Number(f.vcpu), ramMb: Number(f.ramMb), diskGb: Number(f.diskGb), storage: f.storage, bridge: f.bridge, vlan: f.vlan ? Number(f.vlan) : undefined, ip: f.ip || undefined, ipPoolId: f.ipPoolId || undefined, rootPassword: f.rootPassword || undefined, sshKey: f.sshKey || undefined, cloudInit: f.cloudInit };
      const r = await api.post('/vms', body);
      toast(`VM creating — task ${r.data.taskId}`); nav(`/vms/${r.data.vm.id}`);
    } catch (e) { toast(errMsg(e), false); } finally { setBusy(false); }
  };
  const steps = ['Cluster & type', 'Template / ISO & plan', 'Resources', 'Network', 'Access'];
  return <div className="space-y-5 max-w-3xl">
    <h1 className="text-2xl font-bold">Create VM / Container</h1>
    <div className="flex gap-2 flex-wrap">{steps.map((s, i) => <button key={s} onClick={() => setStep(i)} className={`rounded-full px-3 py-1 text-sm ${step === i ? 'bg-orange-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}>{i + 1}. {s}</button>)}</div>
    <Card className="p-5 space-y-4">
      {step === 0 && <>
        <div><label className="text-sm font-medium">Cluster</label><Select value={f.clusterId} onChange={(e) => set('clusterId', e.target.value)}><option value="">Select cluster…</option>{(clusters.data || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}</Select></div>
        <div><label className="text-sm font-medium">Node (blank = auto-select least loaded)</label><Select value={f.node} onChange={(e) => set('node', e.target.value)}><option value="">Auto-select</option>{(nodes.data || []).map((n: any) => <option key={n.node} value={n.node}>{n.node} ({n.status})</option>)}</Select></div>
        <div><label className="text-sm font-medium">Type</label><Select value={f.type} onChange={(e) => set('type', e.target.value)}><option value="QEMU">VM (QEMU)</option><option value="LXC">Container (LXC)</option></Select></div>
        <div><label className="text-sm font-medium">Name</label><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="web-01" /></div>
      </>}
      {step === 1 && <>
        <div><label className="text-sm font-medium">Plan (sets CPU/RAM/disk defaults)</label><Select value={f.planId} onChange={(e) => { set('planId', e.target.value); const p = (plans.data || []).find((x: any) => x.id === e.target.value); if (p) { set('vcpu', p.vcpu); set('ramMb', p.ramMb); set('diskGb', p.diskGb); } }}><option value="">Custom…</option>{(plans.data || []).map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.vcpu} vCPU / {(p.ramMb / 1024).toFixed(0)} GB / {p.diskGb} GB</option>)}</Select></div>
        <div><label className="text-sm font-medium">Clone from template VMID (optional)</label><Input type="number" value={f.cloneFromVmid} onChange={(e) => set('cloneFromVmid', e.target.value)} placeholder="e.g. 9000" /></div>
        <div><label className="text-sm font-medium">Or ISO volid (optional)</label><Input value={f.iso} onChange={(e) => set('iso', e.target.value)} placeholder="local:iso/debian-12.iso" /></div>
      </>}
      {step === 2 && <div className="grid grid-cols-3 gap-4">
        <div><label className="text-sm font-medium">vCPU</label><Input type="number" min={1} value={f.vcpu} onChange={(e) => set('vcpu', e.target.value)} /></div>
        <div><label className="text-sm font-medium">RAM (MB)</label><Input type="number" min={128} value={f.ramMb} onChange={(e) => set('ramMb', e.target.value)} /></div>
        <div><label className="text-sm font-medium">Disk (GB)</label><Input type="number" min={1} value={f.diskGb} onChange={(e) => set('diskGb', e.target.value)} /></div>
        <div className="col-span-3"><label className="text-sm font-medium">Storage</label><Input value={f.storage} onChange={(e) => set('storage', e.target.value)} /></div>
      </div>}
      {step === 3 && <>
        <div><label className="text-sm font-medium">Bridge</label><Input value={f.bridge} onChange={(e) => set('bridge', e.target.value)} /></div>
        <div><label className="text-sm font-medium">VLAN (optional)</label><Input type="number" value={f.vlan} onChange={(e) => set('vlan', e.target.value)} /></div>
        <div><label className="text-sm font-medium">IP: static, "dhcp", or blank + pool</label><Input value={f.ip} onChange={(e) => set('ip', e.target.value)} placeholder="dhcp" /></div>
        <div><label className="text-sm font-medium">IP pool (auto-assign)</label><Select value={f.ipPoolId} onChange={(e) => set('ipPoolId', e.target.value)}><option value="">None</option>{(pools.data || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
      </>}
      {step === 4 && <>
        <div><label className="text-sm font-medium">Root password</label><Input type="password" value={f.rootPassword} onChange={(e) => set('rootPassword', e.target.value)} /></div>
        <div><label className="text-sm font-medium">SSH public key</label><Input value={f.sshKey} onChange={(e) => set('sshKey', e.target.value)} placeholder="ssh-ed25519 AAAA…" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.cloudInit} onChange={(e) => set('cloudInit', e.target.checked)} /> Enable cloud-init (QEMU)</label>
        <p className="text-sm text-zinc-500">Quota is validated server-side before creation. You will get a task ID to track progress.</p>
      </>}
      <div className="flex justify-between pt-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < 4 ? <Button onClick={() => setStep(step + 1)}>Next</Button> : <Button disabled={busy || !f.clusterId || !f.name} onClick={submit}>{busy ? 'Creating…' : 'Create VM'}</Button>}
      </div>
    </Card>
  </div>;
}

export function DeleteVmModal({ vm, onClose }: { vm: any; onClose: () => void }) {
  const [confirm, setConfirm] = useState(''); const [purge, setPurge] = useState(false); const { toast } = useToast(); const nav = useNavigate();
  const run = async () => { try { await api.delete(`/vms/${vm.id}`, { data: { confirmName: confirm, purgeDisks: purge } }); toast('VM soft-deleted (restore window open)'); nav('/vms'); } catch (e) { toast(errMsg(e), false); } };
  return <Modal open title={`Delete ${vm.name}?`} onClose={onClose}>
    <p className="text-sm text-zinc-500 mb-3">The VM will be stopped and soft-deleted. Type the VM name <b>{vm.name}</b> to confirm.</p>
    <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={vm.name} />
    <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} /> Also purge disks/backups on hard delete</label>
    <div className="flex gap-2 justify-end mt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={confirm !== vm.name} onClick={run}>Delete VM</Button></div>
  </Modal>;
}
