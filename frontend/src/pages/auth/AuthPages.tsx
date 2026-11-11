import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Card, Input, Label, useToast } from '../../components/ui/ui';
function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-md p-6"><h1 className="text-xl font-bold mb-1">Proxmox Portal</h1><h2 className="text-sm text-zinc-500 mb-5">{title}</h2>{children}</Card></div>;
}
export function LoginPage() {
  const { login } = useAuth(); const nav = useNavigate(); const { toast } = useToast();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [totp, setTotp] = useState(''); const [need2fa, setNeed2fa] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await login(email, password, totp || undefined); nav('/'); } catch (err) { if (errMsg(err).includes('2FA')) setNeed2fa(true); toast(errMsg(err), false); } finally { setBusy(false); } };
  return <Shell title="Sign in to your account"><form onSubmit={submit} className="space-y-4">
    <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
    <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
    {need2fa && <div><Label>2FA code (TOTP or backup code)</Label><Input value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="123456" autoComplete="one-time-code" /></div>}
    <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
    <p className="text-sm text-zinc-500 flex justify-between"><Link to="/forgot-password" className="text-orange-600">Forgot password?</Link><Link to="/register" className="text-orange-600">Create account</Link></p>
  </form></Shell>;
}
export function RegisterPage() {
  const nav = useNavigate(); const { toast } = useToast(); const [f, setF] = useState({ name: '', email: '', password: '' }); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await api.post('/auth/register', f); toast('Registered — check your email to verify.'); nav('/login'); } catch (err) { toast(errMsg(err), false); } finally { setBusy(false); } };
  return <Shell title="Create account"><form onSubmit={submit} className="space-y-4">
    <div><Label>Name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
    <div><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
    <div><Label>Password (8+ chars, letters + numbers)</Label><Input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
    <Button type="submit" disabled={busy} className="w-full">Register</Button>
    <p className="text-sm text-zinc-500">Already have an account? <Link to="/login" className="text-orange-600">Sign in</Link></p>
  </form></Shell>;
}
export function ForgotPage() {
  const { toast } = useToast(); const [email, setEmail] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); try { await api.post('/auth/forgot-password', { email }); toast('If the email exists, a reset link was sent.'); } catch (err) { toast(errMsg(err), false); } };
  return <Shell title="Forgot password"><form onSubmit={submit} className="space-y-4"><div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><Button type="submit" className="w-full">Send reset link</Button><p className="text-sm"><Link to="/login" className="text-orange-600">Back to sign in</Link></p></form></Shell>;
}
export function ResetPage() {
  const [params] = useSearchParams(); const nav = useNavigate(); const { toast } = useToast(); const [password, setPassword] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); try { await api.post('/auth/reset-password', { token: params.get('token'), password }); toast('Password reset. Sign in.'); nav('/login'); } catch (err) { toast(errMsg(err), false); } };
  return <Shell title="Reset password"><form onSubmit={submit} className="space-y-4"><div><Label>New password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div><Button type="submit" className="w-full">Reset password</Button></form></Shell>;
}
export function VerifyPage() {
  const [params] = useSearchParams(); const { toast } = useToast(); const nav = useNavigate(); const [done, setDone] = useState(false);
  const run = async () => { try { await api.post('/auth/verify-email', { token: params.get('token') }); setDone(true); toast('Email verified'); } catch (err) { toast(errMsg(err), false); } };
  return <Shell title="Verify email">{done ? <p>Email verified. <button className="text-orange-600" onClick={() => nav('/login')}>Sign in</button></p> : <Button onClick={run} className="w-full">Verify my email</Button>}</Shell>;
}
