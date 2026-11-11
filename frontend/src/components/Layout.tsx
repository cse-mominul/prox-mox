import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Server, LayoutDashboard, Users, Network, Layers, ScrollText, Settings, LifeBuoy, KeyRound, Bell, Moon, Sun, LogOut, ListTodo, Boxes } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, isAdmin } from '../lib/auth';
import { api } from '../lib/api';
import { Button } from './ui/ui';
const link = ({ isActive }: { isActive: boolean }) => `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-orange-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`;
export default function Layout() {
  const { me, logout } = useAuth(); const nav = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('theme', dark ? 'dark' : 'light'); }, [dark]);
  const { data: notifs } = useQuery({ queryKey: ['notifs'], queryFn: async () => (await api.get('/notifications')).data, refetchInterval: 30000 });
  const unread = Array.isArray(notifs) ? notifs.filter((n: { readAt?: string }) => !n.readAt).length : 0;
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hidden md:flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 py-3 font-bold text-lg"><Server className="text-orange-600" /> Proxmox Portal</div>
        <NavLink to="/" className={link}><LayoutDashboard size={17} /> Dashboard</NavLink>
        <NavLink to="/vms" className={link}><Boxes size={17} /> My VMs</NavLink>
        <NavLink to="/tasks" className={link}><ListTodo size={17} /> Tasks</NavLink>
        <NavLink to="/tickets" className={link}><LifeBuoy size={17} /> Support</NavLink>
        {isAdmin(me) && <>
          <p className="px-3 pt-4 pb-1 text-xs uppercase tracking-wide text-zinc-400">Admin</p>
          <NavLink to="/admin/clusters" className={link}><Server size={17} /> Clusters</NavLink>
          <NavLink to="/admin/users" className={link}><Users size={17} /> Users</NavLink>
          <NavLink to="/admin/plans" className={link}><Layers size={17} /> Plans</NavLink>
          <NavLink to="/admin/ipam" className={link}><Network size={17} /> IP Pools</NavLink>
          <NavLink to="/admin/audit" className={link}><ScrollText size={17} /> Audit Log</NavLink>
          <NavLink to="/admin/settings" className={link}><Settings size={17} /> Settings</NavLink>
        </>}
        <div className="mt-auto space-y-1">
          <NavLink to="/profile" className={link}><KeyRound size={17} /> Profile & Security</NavLink>
          <button onClick={() => setDark(!dark)} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">{dark ? <Sun size={17} /> : <Moon size={17} />} {dark ? 'Light' : 'Dark'} mode</button>
          <button onClick={async () => { await logout(); nav('/login'); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"><LogOut size={17} /> Logout</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3 sticky top-0 z-40">
          <NavLink to="/vms/new"><Button>+ Create VM</Button></NavLink>
          <div className="flex items-center gap-4">
            <span className="relative" aria-label={`${unread} unread notifications`}><Bell size={19} />{unread > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] rounded-full px-1">{unread}</span>}</span>
            <span className="text-sm text-zinc-500">{me?.name} · {me?.role}</span>
          </div>
        </header>
        <div className="p-5 max-w-7xl mx-auto"><Outlet /></div>
      </main>
    </div>
  );
}
