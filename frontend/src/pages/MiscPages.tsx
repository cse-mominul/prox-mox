import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, Badge, Input, EmptyState, useToast } from '../components/ui/ui';

export function TasksPage() {
  const { data } = useQuery({ queryKey: ['tasks'], queryFn: async () => (await api.get('/tasks', { params: { limit: 50 } })).data, refetchInterval: 5000 });
  const list = data?.data || [];
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Tasks</h1>
    <p className="text-sm text-zinc-500">Long-running Proxmox operations (UPID-tracked). This page auto-refreshes; live progress also streams via SSE at /api/v1/tasks/stream.</p>
    {list.length === 0 ? <Card><EmptyState title="No tasks yet" /></Card> : list.map((t: any) => <Card key={t.id} className="p-4">
      <div className="flex justify-between flex-wrap gap-2"><span className="font-medium">{t.action}</span><Badge tone={t.status === 'SUCCESS' ? 'green' : t.status === 'FAILED' ? 'red' : 'amber'}>{t.status}</Badge></div>
      <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded mt-2 overflow-hidden"><div className="h-full bg-orange-600 transition-all" style={{ width: `${t.progress}%` }} /></div>
      <p className="text-xs text-zinc-500 mt-1.5">{new Date(t.createdAt).toLocaleString()} {t.upid ? `· ${t.upid.slice(0, 40)}…` : ''} {t.error && <span className="text-red-600">· {t.error}</span>}</p>
      {t.log && <pre className="text-xs bg-zinc-950 text-zinc-200 rounded p-3 mt-2 overflow-x-auto max-h-40 overflow-y-auto">{t.log}</pre>}
    </Card>)}
  </div>;
}
export function TicketsPage() {
  const qc = useQueryClient(); const { toast } = useToast(); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [reply, setReply] = useState<Record<string, string>>({});
  const { data } = useQuery({ queryKey: ['tickets'], queryFn: async () => (await api.get('/tickets')).data });
  const list = Array.isArray(data) ? data : [];
  const create = async () => { try { await api.post('/tickets', { subject, body }); setSubject(''); setBody(''); qc.invalidateQueries({ queryKey: ['tickets'] }); toast('Ticket opened'); } catch (e) { toast(errMsg(e), false); } };
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Support Tickets</h1>
    <Card className="p-4 space-y-3"><Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} /><Input placeholder="Describe the issue…" value={body} onChange={(e) => setBody(e.target.value)} /><Button disabled={!subject || !body} onClick={create}>Open ticket</Button></Card>
    {list.map((t: any) => <Card key={t.id} className="p-4"><div className="flex justify-between"><b>{t.subject}</b><Badge tone={t.status === 'OPEN' ? 'amber' : 'green'}>{t.status}</Badge></div>
      <TicketThread id={t.id} reply={reply[t.id] || ''} setReply={(v) => setReply({ ...reply, [t.id]: v })} /></Card>)}
    {list.length === 0 && <Card><EmptyState title="No tickets" /></Card>}
  </div>;
}
function TicketThread({ id, reply, setReply }: { id: string; reply: string; setReply: (v: string) => void }) {
  const qc = useQueryClient(); const { data } = useQuery({ queryKey: ['ticket', id], queryFn: async () => (await api.get(`/tickets/${id}`)).data });
  const msgs = data?.messages || [];
  return <div className="mt-3 space-y-2">{msgs.map((m: any) => <p key={m.id} className="text-sm bg-zinc-50 dark:bg-zinc-800 rounded p-2.5">{m.body} <span className="text-zinc-400 text-xs">{new Date(m.createdAt).toLocaleString()}</span></p>)}
    <div className="flex gap-2"><Input placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} /><Button variant="outline" onClick={async () => { await api.post(`/tickets/${id}/reply`, { body: reply }); setReply(''); qc.invalidateQueries({ queryKey: ['ticket', id] }); }}>Reply</Button></div></div>;
}
export function ProfilePage() {
  const { me, refreshMe } = useAuth(); const { toast } = useToast(); const qc = useQueryClient();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' }); const [qr, setQr] = useState<any>(null); const [code, setCode] = useState(''); const [keyName, setKeyName] = useState('automation'); const [newKey, setNewKey] = useState('');
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: async () => (await api.get('/auth/sessions')).data });
  const activity = useQuery({ queryKey: ['my-activity'], queryFn: async () => (await api.get('/tasks', { params: { limit: 10 } })).data });
  const keys = useQuery({ queryKey: ['api-keys'], queryFn: async () => (await api.get('/api-keys')).data });
  return <div className="space-y-5 max-w-3xl"><h1 className="text-2xl font-bold">Profile & Security</h1>
    <Card className="p-5 space-y-2"><p><b>{me?.name}</b> · {me?.email}</p><Badge>{me?.role}</Badge><p className="text-sm text-zinc-500">2FA: {me?.twoFactorEnabled ? 'Enabled' : 'Disabled'}</p></Card>
    <Card className="p-5 space-y-3"><h2 className="font-semibold">Change password</h2><Input type="password" placeholder="Current password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /><Input type="password" placeholder="New password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /><Button onClick={async () => { try { await api.post('/auth/change-password', pw); toast('Password changed'); } catch (e) { toast(errMsg(e), false); } }}>Change password</Button></Card>
    <Card className="p-5 space-y-3"><h2 className="font-semibold">Two-factor authentication (TOTP)</h2>
      {!me?.twoFactorEnabled ? <><Button variant="outline" onClick={async () => setQr((await api.post('/auth/2fa/setup')).data)}>Set up 2FA</Button>
        {qr && <div className="space-y-2"><img src={qr.qrDataUrl} alt="2FA QR code" className="w-44 h-44 rounded border" /><p className="text-xs break-all text-zinc-500">Secret: {qr.secret}</p><Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[200px]" /><Button onClick={async () => { try { const r = await api.post('/auth/2fa/enable', { code }); toast('2FA enabled'); alert(`Backup codes (store safely):\n${r.data.backupCodes.join('\n')}`); refreshMe(); } catch (e) { toast(errMsg(e), false); } }}>Enable 2FA</Button></div>}</>
      : <div className="flex gap-2"><Input placeholder="Current 2FA code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[200px]" /><Button variant="danger" onClick={async () => { await api.post('/auth/2fa/disable', { code }); toast('2FA disabled'); refreshMe(); }}>Disable 2FA</Button></div>}
    </Card>
    <Card className="p-5 space-y-3"><h2 className="font-semibold">Active sessions</h2>{(sessions.data || []).map((s: any) => <p key={s.id} className="text-sm text-zinc-500">{s.ip || '—'} · {s.userAgent?.slice(0, 60) || '—'} · {new Date(s.createdAt).toLocaleString()}</p>)}
      <Button variant="outline" onClick={async () => { await api.post('/auth/sessions/revoke-all'); toast('All sessions revoked — sign in again'); }}>Revoke all sessions</Button></Card>
    <Card className="p-5 space-y-3"><h2 className="font-semibold">Personal API keys</h2>
      <div className="flex gap-2"><Input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="max-w-[220px]" /><Button variant="outline" onClick={async () => { const r = await api.post('/api-keys', { name: keyName, scopes: ['vms:read', 'vms:write'] }); setNewKey(r.data.plainTextKey); qc.invalidateQueries({ queryKey: ['api-keys'] }); }}>Create key</Button></div>
      {newKey && <p className="text-xs break-all bg-amber-50 dark:bg-amber-900/30 border border-amber-200 rounded p-2">Shown once: <b>{newKey}</b></p>}
      {(keys.data || []).map((k: any) => <div key={k.id} className="flex justify-between text-sm border rounded p-2.5"><span>{k.name} · {k.keyPrefix}… · {(k.scopes || []).join(', ')}</span>{!k.revokedAt && <Button variant="danger" onClick={async () => { await api.delete(`/api-keys/${k.id}`); qc.invalidateQueries({ queryKey: ['api-keys'] }); }}>Revoke</Button>}</div>)}
    </Card>
    <Card className="p-5"><h2 className="font-semibold mb-2">Recent activity</h2>{(activity.data?.data || []).map((t: any) => <p key={t.id} className="text-sm text-zinc-500">{t.action} — {t.status} · {new Date(t.createdAt).toLocaleString()}</p>)}</Card>
  </div>;
}
