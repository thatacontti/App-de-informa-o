// Sync queue singleton for the web side. The BullMQ worker
// (packages/jobs/src/worker.ts) consumes jobs from this queue.
//
// Lazy connect — `next build` doesn't reach Redis until a request
// actually enqueues something.

import { createSyncQueue, type SyncJobData } from '@painel/jobs';
import { Queue } from 'bullmq';
import { redis } from './redis';

declare global {
  // eslint-disable-next-line no-var
  var syncQueueSingleton: Queue<SyncJobData> | undefined;
}

export const syncQueue: Queue<SyncJobData> =
  globalThis.syncQueueSingleton ?? createSyncQueue(redis);

if (process.env.NODE_ENV !== 'production') globalThis.syncQueueSingleton = syncQueue;
