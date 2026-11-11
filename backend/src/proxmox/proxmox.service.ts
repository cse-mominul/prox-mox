import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { ClusterLike as Cluster } from '../common/types';
import { decryptSecret } from '../common/utils/crypto';

export interface ProxmoxTaskStatus { status: string; exitstatus?: string; pid?: number; starttime?: number; }
/**
 * Dedicated Proxmox VE API layer.
 * Auth: API Token header `Authorization: PVEAPIToken=user@realm!tokenid=SECRET` (secret never leaves server).
 * Features: per-cluster client cache, TLS verify toggle (self-signed), timeout, retry w/ backoff
 * for idempotent reads, error mapping to BadGateway, UPID polling helper.
 */
@Injectable()
export class ProxmoxService {
  private log = new Logger(ProxmoxService.name);
  private clients = new Map<string, AxiosInstance>();

  baseUrl(c: Pick<Cluster, 'host' | 'port'>) { return `https://${c.host}:${c.port}/api2/json`; }
  client(cluster: Cluster): AxiosInstance {
    const cached = this.clients.get(cluster.id);
    if (cached) return cached;
    const secret = decryptSecret(cluster.tokenSecretEnc);
    const http = axios.create({
      baseURL: this.baseUrl(cluster),
      timeout: 30_000,
      httpsAgent: new https.Agent({ rejectUnauthorized: cluster.verifyTls }),
      headers: { Authorization: `PVEAPIToken=${cluster.tokenId}=${secret}` },
      validateStatus: () => true,
    });
    this.clients.set(cluster.id, http);
    return http;
  }
  invalidate(clusterId: string) { this.clients.delete(clusterId); }

  /** Map Proxmox errors to a consistent API error; never leak token. */
  private mapError(cluster: Cluster, status: number, data: unknown): BadGatewayException {
    const msg = (data as any)?.errors ? JSON.stringify((data as any).errors) : (data as any)?.message || `Proxmox HTTP ${status}`;
    return new BadGatewayException(`Proxmox cluster "${cluster.name}": ${msg}`);
  }
  async request<T = any>(cluster: Cluster, method: 'GET'|'POST'|'PUT'|'DELETE', path: string, opts: { params?: Record<string, unknown>; data?: Record<string, unknown>; retries?: number } = {}): Promise<T> {
    const http = this.client(cluster);
    const idempotent = method === 'GET';
    const attempts = idempotent ? (opts.retries ?? 3) : 1;
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await http.request({ method, url: path, params: opts.params, data: opts.data ? new URLSearchParams(Object.entries(opts.data).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])) : undefined, headers: opts.data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined });
        if (res.status >= 400) throw this.mapError(cluster, res.status, res.data);
        return (res.data?.data ?? res.data) as T;
      } catch (e) {
        lastErr = e;
        if (e instanceof BadGatewayException) throw e;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * 2 ** i));
      }
    }
    this.log.warn(`Proxmox request failed ${method} ${path}: ${(lastErr as Error)?.message}`);
    throw lastErr instanceof Error ? new BadGatewayException(lastErr.message) : new BadGatewayException('Proxmox request failed');
  }
  get<T = any>(c: Cluster, p: string, params?: Record<string, unknown>) { return this.request<T>(c, 'GET', p, { params }); }
  post<T = any>(c: Cluster, p: string, data?: Record<string, unknown>) { return this.request<T>(c, 'POST', p, { data }); }
  put<T = any>(c: Cluster, p: string, data?: Record<string, unknown>) { return this.request<T>(c, 'PUT', p, { data }); }
  del<T = any>(c: Cluster, p: string, params?: Record<string, unknown>) { return this.request<T>(c, 'DELETE', p, { params }); }

  // --- Wrapped endpoints ---
  version(c: Cluster) { return this.get(c, '/version'); }
  clusterStatus(c: Cluster) { return this.get<any[]>(c, '/cluster/status'); }
  nodes(c: Cluster) { return this.get<any[]>(c, '/nodes'); }
  nodeStatus(c: Cluster, node: string) { return this.get(c, `/nodes/${node}/status`); }
  storages(c: Cluster, node: string) { return this.get<any[]>(c, `/nodes/${node}/storage`); }
  storageContent(c: Cluster, node: string, storage: string, content?: string) { return this.get<any[]>(c, `/nodes/${node}/storage/${storage}/content`, content ? { content } : undefined); }
  bridges(c: Cluster, node: string) { return this.get<any[]>(c, `/nodes/${node}/network`, { type: 'bridge' }); }
  async templates(c: Cluster, node: string) {
    const vms = await this.get<any[]>(c, `/cluster/resources`, { type: 'vm' });
    return vms.filter((v) => v.node === node && v.template === 1);
  }
  nextVmid(c: Cluster) { return this.get<string>(c, '/cluster/nextid'); }
  qemuList(c: Cluster, node: string) { return this.get<any[]>(c, `/nodes/${node}/qemu`); }
  lxcList(c: Cluster, node: string) { return this.get<any[]>(c, `/nodes/${node}/lxc`); }
  vmStatus(c: Cluster, node: string, type: 'qemu'|'lxc', vmid: number) { return this.get(c, `/nodes/${node}/${type}/${vmid}/status/current`); }
  vmConfig(c: Cluster, node: string, type: 'qemu'|'lxc', vmid: number) { return this.get(c, `/nodes/${node}/${type}/${vmid}/config`); }
  rrddata(c: Cluster, node: string, type: 'qemu'|'lxc', vmid: number, timeframe = 'hour') { return this.get<any[]>(c, `/nodes/${node}/${type}/${vmid}/rrddata`, { timeframe, cf: 'AVERAGE' }); }
  taskStatus(c: Cluster, node: string, upid: string) { return this.get<ProxmoxTaskStatus>(c, `/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`); }
  taskLog(c: Cluster, node: string, upid: string) { return this.get<any[]>(c, `/nodes/${node}/tasks/${encodeURIComponent(upid)}/log`); }
  /** Poll UPID until stopped (used by worker; timeout default 30 min). onProgress called each poll. */
  async pollTask(c: Cluster, node: string, upid: string, onProgress?: (s: ProxmoxTaskStatus) => Promise<void> | void, timeoutMs = 30 * 60_000): Promise<ProxmoxTaskStatus> {
    const started = Date.now();
    for (;;) {
      const s = await this.taskStatus(c, node, upid);
      if (onProgress) await onProgress(s);
      if (s.status === 'stopped') return s;
      if (Date.now() - started > timeoutMs) throw new BadGatewayException(`Task ${upid} timed out`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  async vncProxy(c: Cluster, node: string, type: 'qemu'|'lxc', vmid: number) {
    // Returns { port, ticket, cert, user } — frontend builds noVNC ws url via backend proxy endpoint.
    return this.post<{ port: number; ticket: string; cert?: string; user?: string }>(c, `/nodes/${node}/${type}/${vmid}/vncproxy`, { websocket: 1 });
  }
  async termProxy(c: Cluster, node: string, vmid: number) { return this.post<{ port: number; ticket: string; user?: string }>(c, `/nodes/${node}/lxc/${vmid}/termproxy`); }
}
