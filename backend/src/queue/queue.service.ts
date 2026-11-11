import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
@Injectable()
export class QueueService implements OnModuleDestroy {
  private log = new Logger(QueueService.name);
  private connection?: IORedis;
  private queue?: Queue;
  private getQueue(): Queue | null {
    if (this.queue) return this.queue;
    try {
      this.connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: true });
      this.queue = new Queue('proxmox-tasks', { connection: this.connection });
      return this.queue;
    } catch { return null; }
  }
  /** Enqueue UPID polling; falls back to in-process polling when Redis is unavailable (dev). */
  async enqueueUpidPoll(taskId: string, fallback: () => Promise<void>) {
    try {
      const q = this.getQueue();
      if (!q) throw new Error('no queue');
      await q.add('poll-upid', { taskId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 100 });
    } catch (e) {
      this.log.warn(`Queue unavailable (${(e as Error).message}); polling in-process`);
      void fallback();
    }
  }
  async onModuleDestroy() { await this.queue?.close().catch(() => undefined); this.connection?.disconnect(); }
}
