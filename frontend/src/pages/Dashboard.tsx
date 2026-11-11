import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth, isAdmin } from '../lib/auth';
import { Card, Badge, Skeleton, EmptyState, Button } from '../components/ui/ui';
export default function Dashboard() {
  const { me } = useAuth();
  const usage = useQuery({ queryKey: ['usage'], queryFn: async () => (await api.get('/users/me/usage')).data });
  const admin = useQuery({ queryKey: ['admin-dash'], queryFn: async () => (await api.get('/admin/dashboard')).data, enabled: isAdmin(me) });
  const vms = useQuery({ queryKey: ['vms', 'dash'], queryFn: async () => (await api.get('/vms', { params: { limit: 100 } })).data });
  const list = vms.data?.data || [];
  const running = list.filter((v: { status: string }) => v.status === 'RUNNING').length;
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Dashboard</h1>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-4"><p className="text-sm text-zinc-500">My VMs</p><p className="text-3xl font-bold mt-1">{vms.isLoading ? <Skeleton className="h-8 w-16" /> : list.length}</p></Card>
      <Card className="p-4"><p className="text-sm text-zinc-500">Running</p><p className="text-3xl font-bold mt-1 text-green-600">{running}</p></Card>
      <Card className="p-4"><p className="text-sm text-zinc-500">Quota (VMs)</p><p className="text-3xl font-bold mt-1">{usage.data ? `${usage.data.used.vms}/${usage.data.quota?.maxVms ?? '∞'}` : '—'}</p><p className="text-xs text-zinc-500 mt-1">{usage.data ? `${usage.data.used.vcpu} vCPU · ${(usage.data.used.ramMb / 1024).toFixed(1)} GB RAM · ${usage.data.used.diskGb} GB disk` : ''}</p></Card>
      <Card className="p-4"><p className="text-sm text-zinc-500">Account</p><p className="font-semibold mt-1">{me?.name}</p><Badge tone="zinc">{me?.role}</Badge></Card>
    </div>
    {isAdmin(me) && admin.data && <Card className="p-4"><h2 className="font-semibold mb-3">Cluster overview (admin)</h2>
      <p className="text-sm text-zinc-500 mb-3">Users: {admin.data.totals.users} · VMs: {admin.data.totals.vmsTotal} ({admin.data.totals.vmsRunning} running)</p>
      <div className="grid gap-3 md:grid-cols-2">{(admin.data.clusterUsage || []).map((c: any, i: number) => <div key={i} className="rounded-lg border p-3"><p className="font-medium">{c.cluster}</p>{c.error ? <p className="text-sm text-red-600">{c.error}</p> : (c.nodes || []).map((n: any) => <p key={n.node} className="text-sm text-zinc-500">{n.node}: <Badge tone={n.status === 'online' ? 'green' : 'red'}>{n.status}</Badge> CPU {Math.round((n.cpu || 0) * 100)}% · RAM {n.maxmem ? Math.round((n.mem / n.maxmem) * 100) : 0}%</p>)}</div>)}</div>
      {admin.data.alerts?.length > 0 && <div className="mt-3 text-sm text-red-600">{admin.data.alerts.length} recent failed task(s) — see Tasks.</div>}
    </Card>}
    <Card className="p-4"><div className="flex justify-between items-center mb-3"><h2 className="font-semibold">Recent VMs</h2><Link to="/vms"><Button variant="outline">View all</Button></Link></div>
      {vms.isLoading ? <Skeleton /> : list.length === 0 ? <EmptyState title="No VMs yet" hint="Create your first virtual machine or container." action={<Link to="/vms/new"><Button>Create VM</Button></Link>} /> :
      <div className="divide-y">{list.slice(0, 6).map((v: any) => <Link key={v.id} to={`/vms/${v.id}`} className="flex justify-between py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-2 rounded"><span className="font-medium">{v.name} <span className="text-zinc-400 text-sm">#{v.vmid} · {v.node}</span></span><Badge tone={v.status === 'RUNNING' ? 'green' : 'zinc'}>{v.status}</Badge></Link>)}</div>}
    </Card>
  </div>;
}
