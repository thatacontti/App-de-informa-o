import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { syncDataSource } from './sync/jobs';

export const QUEUE_NAMES = {
  sync: 'painel:sync',
  briefing: 'painel:briefing',
  alerts: 'painel:alerts',
} as const;

export interface SyncJobData {
  dataSourceId: string;
  triggeredBy: 'scheduler' | 'manual';
  triggeredByUserId?: string;
}

export function createSyncQueue(connection: Redis): Queue<SyncJobData> {
  return new Queue<SyncJobData>(QUEUE_NAMES.sync, { connection });
}

export interface SyncWorkerEnv {
  useMock: boolean;
  fixturesDir?: string;
  concurrency?: number;
}

export function createSyncWorker(
  db: PrismaClient,
  connection: Redis,
  env: SyncWorkerEnv,
): Worker<SyncJobData> {
  return new Worker<SyncJobData>(
    QUEUE_NAMES.sync,
    async (job: Job<SyncJobData>) => {
      return syncDataSource(db, job.data.dataSourceId, {
        useMock: env.useMock,
        fixturesDir: env.fixturesDir,
      });
    },
    { connection, concurrency: env.concurrency ?? 2 },
  );
}
