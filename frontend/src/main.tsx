import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider, Spinner } from './components/ui/ui';
import Layout from './components/Layout';
import { LoginPage, RegisterPage, ForgotPage, ResetPage, VerifyPage } from './pages/auth/AuthPages';
import Dashboard from './pages/Dashboard';
import { VmsListPage, VmCreatePage } from './pages/vm/VmsPages';
import VmDetailPage from './pages/vm/VmDetail';
import { ClustersPage, UsersPage, PlansPage, IpamPage, AuditPage, SettingsPage } from './pages/admin/AdminPages';
import { TasksPage, TicketsPage, ProfilePage } from './pages/MiscPages';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
function Protected({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  return me ? <>{children}</> : <Navigate to="/login" replace />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={qc}><BrowserRouter><AuthProvider><ToastProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPage />} /><Route path="/reset-password" element={<ResetPage />} /><Route path="/verify-email" element={<VerifyPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/vms" element={<VmsListPage />} /><Route path="/vms/new" element={<VmCreatePage />} /><Route path="/vms/:id" element={<VmDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} /><Route path="/tickets" element={<TicketsPage />} /><Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin/clusters" element={<ClustersPage />} /><Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/plans" element={<PlansPage />} /><Route path="/admin/ipam" element={<IpamPage />} />
        <Route path="/admin/audit" element={<AuditPage />} /><Route path="/admin/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </ToastProvider></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>,
);
