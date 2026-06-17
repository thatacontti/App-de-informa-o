import { z } from 'zod';
import {
  classifyProfiles,
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

  // Liga/desliga uma DataSource direto pela UI — evita admin precisar
  // abrir Prisma Studio só pra trocar o boolean. Útil pra ativar fontes
  // semeadas como inativas (Base44 · Sale, CSV histórico).
  toggleActive: requireAction('admin:datasources')
    .input(z.object({ dataSourceId: z.string().min(1), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: input.active ? 'datasource.activated' : 'datasource.deactivated',
          payload: { dataSourceId: input.dataSourceId },
        },
      });
      return db.dataSource.update({
        where: { id: input.dataSourceId },
        data: { active: input.active },
        select: { id: true, active: true, name: true },
      });
    }),

  // Reclassifica CustomerProfile a partir do histórico de coleções.
  // Usa as duas coleções mais recentes (por MAX(date)) como current /
  // previous; o admin pode override via input quando precisar.
  reclassifyProfiles: requireAction('admin:trigger-sync')
    .input(
      z
        .object({
          currentCollection: z.string().optional(),
          previousCollection: z.string().optional(),
          dryRun: z.boolean().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'profiles.reclassify',
          payload: input ? { ...input } : {},
        },
      });
      return classifyProfiles(db, input ?? {});
    }),
});
