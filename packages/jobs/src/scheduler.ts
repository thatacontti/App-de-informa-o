// Scheduler — registers repeatable BullMQ jobs from the DataSource
// table. Each DataSource row carries its own frequencyMinutes; the
// scheduler upserts the repeatable definition so changing frequency
// in the admin UI (step 6+) takes effect on next run.

import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { SyncJobData } from './queues';

export async function registerScheduledSyncs(
  db: PrismaClient,
  queue: Queue<SyncJobData>,
): Promise<{ registered: number }> {
  const sources = await db.dataSource.findMany({ where: { active: true } });

  for (const ds of sources) {
    const jobId = `scheduled:${ds.id}`;
    // Remove any existing repeatable with the same id, then re-add.
    const repeats = await queue.getRepeatableJobs();
    for (const r of repeats) {
      if (r.id === jobId) await queue.removeRepeatableByKey(r.key);
    }
    await queue.add(
      'sync',
      { dataSourceId: ds.id, triggeredBy: 'scheduler' },
      {
        jobId,
        repeat: { every: ds.frequencyMinutes * 60_000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60 },
        removeOnFail: { age: 30 * 24 * 60 * 60 },
      },
    );
  }

  return { registered: sources.length };
}

/** Trigger a one-off (non-scheduled) sync. */
export async function triggerSync(
  queue: Queue<SyncJobData>,
  data: SyncJobData,
): Promise<{ jobId: string }> {
  const job = await queue.add('sync', data, {
    removeOnComplete: { age: 7 * 24 * 60 * 60 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
  });
  return { jobId: job.id ?? 'unknown' };
}
