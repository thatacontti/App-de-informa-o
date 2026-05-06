// /admin/profiles-upload tRPC surface.
//
// The CSV pipeline is intentionally split into one preview procedure
// (parseCsv) and an explicit ImportBatch lifecycle (start → upsertOne …
// upsertOne → finish | cancel). The client drives the loop one record at
// a time so that:
//   - We never hit the tRPC body limit on huge spreadsheets.
//   - The user sees real progress (`X de Y · ok=N · failed=M`) without
//     polling a job status endpoint.
//   - Cancel is a single mutation, no orchestration plumbing.
//
// ImportBatch counters are the source of truth: every successful upsert
// increments recordsOk, every failure increments recordsFail. The batch
// row is closed (status = SUCCESS / FAILED) by an explicit finishBatch
// call — leaving it RUNNING is fine, it just means the operator closed
// the tab; the next admin can see it as stale.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { CUSTOMER_PROFILES, parseProfilesCsv } from '@painel/shared';
import { db } from '@/lib/db';
import { router, requireAction } from '@/lib/trpc/server';

// CustomerProfile zod enum reused across procedures.
const profileEnum = z.enum(CUSTOMER_PROFILES);

const MAX_CSV_BYTES = 5_000_000; // 5 MB — keeps the parser memory bounded.

export const profilesRouter = router({
  /**
   * Stateless CSV parse + preview. Does NOT touch the database — the UI
   * uses this to render the stats panel and the sample table before the
   * operator confirms the import.
   */
  parseCsv: requireAction('admin:upload')
    .input(z.object({ csv: z.string().max(MAX_CSV_BYTES) }))
    .mutation(({ input }) => {
      const result = parseProfilesCsv(input.csv);
      return {
        separator: result.separator,
        totalLines: result.totalLines,
        validCount: result.validRows.length,
        ignoredCount: result.ignored.length,
        distribution: result.distribution,
        sample: result.sample,
        // Cap ignored list at 50 — anything beyond is noise on screen.
        ignored: result.ignored.slice(0, 50),
      };
    }),

  /**
   * Opens a new ImportBatch row in RUNNING status. Returns the batch id,
   * which the client uses to anchor every upsertOne / finishBatch /
   * cancelBatch call.
   */
  startBatch: requireAction('admin:upload')
    .input(
      z.object({
        filename: z.string().max(200).optional(),
        total: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const batch = await db.importBatch.create({
        data: {
          source: 'PROFILES_CSV',
          filename: input.filename ?? null,
          recordsRead: input.total,
          status: 'RUNNING',
          createdBy: ctx.user.id,
          metadata: { stage: 'started' },
        },
      });
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'profiles.upload.start',
          payload: { batchId: batch.id, total: input.total, filename: input.filename ?? null },
        },
      });
      return { batchId: batch.id };
    }),

  /**
   * Single upsert into ClientProfile, called once per row by the client
   * loop. Idempotent (codcli is the PK). Increments the batch counters
   * inline so the dashboard can poll a single ImportBatch row to render
   * progress if the page is reloaded.
   */
  upsertOne: requireAction('admin:upload')
    .input(
      z.object({
        batchId: z.string().min(1),
        codcli: z.string().min(1).max(64),
        profile: profileEnum,
      }),
    )
    .mutation(async ({ input }) => {
      const batch = await db.importBatch.findUnique({ where: { id: input.batchId } });
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND', message: 'batch not found' });
      if (batch.status !== 'RUNNING') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `batch is ${batch.status}, cannot accept more records`,
        });
      }

      try {
        await db.clientProfile.upsert({
          where: { codcli: input.codcli },
          create: {
            codcli: input.codcli,
            profile: input.profile,
            source: 'UPLOAD',
          },
          update: { profile: input.profile, source: 'UPLOAD' },
        });
        await db.importBatch.update({
          where: { id: input.batchId },
          data: { recordsOk: { increment: 1 } },
        });
        return { ok: true as const };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.importBatch.update({
          where: { id: input.batchId },
          data: {
            recordsFail: { increment: 1 },
            metadata: {
              lastError: msg.slice(0, 500),
              lastFailedCodcli: input.codcli,
            },
          },
        });
        return { ok: false as const, error: msg };
      }
    }),

  /**
   * Closes the batch with the final tally. The client passes the
   * succeeded/failed counts it observed locally, plus the first few
   * codclis that failed so the audit trail can show "what fell off".
   */
  finishBatch: requireAction('admin:upload')
    .input(
      z.object({
        batchId: z.string().min(1),
        succeeded: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        failedCodclis: z.array(z.string()).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const status = input.failed === 0 ? 'SUCCESS' : input.succeeded > 0 ? 'SUCCESS' : 'FAILED';
      const batch = await db.importBatch.update({
        where: { id: input.batchId },
        data: {
          status,
          finishedAt: new Date(),
          recordsOk: input.succeeded,
          recordsFail: input.failed,
          errorMessage: input.failed > 0 ? `${input.failed} linhas falharam no upsert` : null,
          metadata: {
            stage: 'finished',
            failedCodclis: input.failedCodclis ?? [],
          },
        },
      });
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'profiles.upload.finish',
          payload: {
            batchId: batch.id,
            succeeded: input.succeeded,
            failed: input.failed,
            status,
          },
        },
      });
      return { batch };
    }),

  /**
   * Marks the batch as FAILED with reason "cancelled". Counters keep
   * whatever value they had at cancellation time — the rows already
   * upserted stay (idempotent).
   */
  cancelBatch: requireAction('admin:upload')
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const batch = await db.importBatch.update({
        where: { id: input.batchId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: 'cancelled by operator',
          metadata: { stage: 'cancelled' },
        },
      });
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'profiles.upload.cancel',
          payload: { batchId: batch.id },
        },
      });
      return { batch };
    }),

  /**
   * Lists the most recent profile-upload batches for the audit panel
   * embedded on /admin/profiles-upload.
   */
  recentBatches: requireAction('admin:upload')
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 10;
      const batches = await db.importBatch.findMany({
        where: { source: 'PROFILES_CSV' },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          filename: true,
          status: true,
          recordsRead: true,
          recordsOk: true,
          recordsFail: true,
          startedAt: true,
          finishedAt: true,
          errorMessage: true,
        },
      });
      return { batches };
    }),
});
