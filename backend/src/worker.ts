/** BullMQ worker entrypoint (docker-compose `worker` service): `node dist/worker.js` */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AppModule } from './app.module';
import { TaskProcessor } from './queue/task.processor';
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const processor = app.get(TaskProcessor);
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
  const worker = new Worker('proxmox-tasks', async (job) => { if (job.name === 'poll-upid') await processor.pollUpid(job.data.taskId); }, { connection, concurrency: 10 });
  worker.on('failed', (job, err) => console.error(`job ${job?.id} failed`, err.message));
  console.log('Worker listening on queue "proxmox-tasks"');
}
main();
