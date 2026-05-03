import { z } from 'zod';
import {
  syncDataSource,
  testDataSource,
} from '@painel/jobs';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { syncQueue } from '@/lib/queues';
import { router, requireAction } from '@/lib/trpc/server';

const triggerInput = z.object({ dataSourceId: z.string().min(1) });

export const dataSourcesRouter = router({
  list: requireAction('admin:datasources').query(async ({ ctx }) => {
    const sources = await db.dataSource.findMany({
      orderBy: { type: 'asc' },
      include: {
        syncs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            status: true,
            recordsIn: true,
            recordsOut: true,
            errorMessage: true,
          },
        },
      },
    });
    return { sources, role: ctx.user.role };
  }),

  testConnection: requireAction('admin:datasources')
    .input(triggerInput)
    .mutation(async ({ input }) => {
      return testDataSource(db, input.dataSourceId, { useMock: env.USE_MOCK_CONNECTORS });
    }),

  triggerSync: requireAction('admin:trigger-sync')
    .input(triggerInput)
    .mutation(async ({ ctx, input }) => {
      // Run inline (not through BullMQ) so the user gets the result
      // synchronously. Scheduled syncs go through the worker.
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'sync.manual',
          payload: { dataSourceId: input.dataSourceId },
        },
      });
      return syncDataSource(db, input.dataSourceId, { useMock: env.USE_MOCK_CONNECTORS });
    }),

  // Background variant — enqueues the sync into BullMQ and returns the
  // SyncRun id immediately. Use for heavy historic loads (CSV) where
  // an inline run would blow the HTTP timeout.
  enqueueSync: requireAction('admin:trigger-sync')
    .input(triggerInput)
    .mutation(async ({ ctx, input }) => {
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'sync.queued',
          payload: { dataSourceId: input.dataSourceId },
        },
      });

      const job = await syncQueue.add(
        'sync-manual',
        {
          dataSourceId: input.dataSourceId,
          triggeredBy: 'manual',
          triggeredByUserId: ctx.user.id,
        },
        { removeOnComplete: 50, removeOnFail: 50 },
      );
      return { jobId: job.id ?? 'unknown', queued: true as const };
    }),
});
