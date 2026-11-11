import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
/** shadcn/ui-style primitives (Tailwind, Radix-compatible class conventions) used across the portal. */
export function Button({ className = '', variant = 'default', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'outline'|'danger'|'ghost' }) {
  const styles = { default: 'bg-orange-600 text-white hover:bg-orange-700', outline: 'border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800', danger: 'bg-red-600 text-white hover:bg-red-700', ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800' }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${styles} ${className}`} />;
}
export function Input(p: InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={`w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${p.className || ''}`} />; }
export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} className={`w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${p.className || ''}`} />; }
export function Label({ children }: { children: ReactNode }) { return <label className="block text-sm font-medium mb-1.5">{children}</label>; }
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm ${className}`}>{children}</div>; }
export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'green'|'red'|'zinc'|'amber' }) {
  const tones = { green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', zinc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
export function Spinner() { return <Loader2 className="h-5 w-5 animate-spin text-orange-600" />; }
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) { return <div className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`} aria-hidden />; }
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center py-14 text-center"><p className="font-medium">{title}</p>{hint && <p className="text-sm text-zinc-500 mt-1">{hint}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">{title}</h3><button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-800 text-xl leading-none">×</button></div>{children}</div></div>;
}
import { createContext, useContext, useState, useCallback } from 'react';
const ToastCtx = createContext<{ toast: (msg: string, ok?: boolean) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; ok: boolean }[]>([]);
  const toast = useCallback((msg: string, ok = true) => { const id = Date.now() + Math.random(); setItems((x) => [...x, { id, msg, ok }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200); }, []);
  return <ToastCtx.Provider value={{ toast }}>{children}<div className="fixed bottom-4 right-4 z-[60] space-y-2" aria-live="polite">{items.map((i) => <div key={i.id} className={`rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${i.ok ? 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900' : 'bg-red-600'}`}>{i.msg}</div>)}</div></ToastCtx.Provider>;
}
