import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { syncDataSource } from './sync/jobs';
import { generateBriefing } from './briefing';

export const QUEUE_NAMES = {
  sync: 'painel-sync',
  briefing: 'painel-briefing',
  alerts: 'painel-alerts',
} as const;

export interface SyncJobData {
  dataSourceId: string;
  triggeredBy: 'scheduler' | 'manual';
  triggeredByUserId?: string;
}

export interface BriefingJobData {
  triggeredBy: 'scheduler' | 'manual';
  triggeredByUserId?: string;
}

export function createSyncQueue(connection: Redis): Queue<SyncJobData> {
  return new Queue<SyncJobData>(QUEUE_NAMES.sync, { connection });
}

export function createBriefingQueue(connection: Redis): Queue<BriefingJobData> {
  return new Queue<BriefingJobData>(QUEUE_NAMES.briefing, { connection });
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

export interface BriefingWorkerOpts {
  storageDir?: string;
  /** When true, scheduled briefings also email + post to Slack. */
  distribute?: boolean;
  slackChannel?: string;
}

export function createBriefingWorker(
  db: PrismaClient,
  connection: Redis,
  opts: BriefingWorkerOpts = {},
): Worker<BriefingJobData> {
  return new Worker<BriefingJobData>(
    QUEUE_NAMES.briefing,
    async (job: Job<BriefingJobData>) => {
      return generateBriefing(db, {
        storageDir: opts.storageDir,
        generatedBy: job.data.triggeredByUserId,
        // Manual triggers stay local; scheduled runs fan out.
        distribute: opts.distribute ?? job.data.triggeredBy === 'scheduler',
        slackChannel: opts.slackChannel,
      });
    },
    { connection, concurrency: 1 },
  );
}
