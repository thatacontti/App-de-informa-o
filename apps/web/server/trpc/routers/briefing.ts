import { z } from 'zod';
import { generateBriefing } from '@painel/jobs';
import { db } from '@/lib/db';
import { router, requireAction } from '@/lib/trpc/server';
import { briefingStorageDir } from '@/lib/briefing-paths';

export const briefingRouter = router({
  latest: requireAction('export:briefing-pdf').query(async () => {
    const snapshot = await db.briefingSnapshot.findFirst({
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        generatedAt: true,
        periodStart: true,
        periodEnd: true,
        headlinesJson: true,
        risksJson: true,
        decisionsJson: true,
        pdfPath: true,
        generatedBy: true,
      },
    });
    return { snapshot };
  }),

  regenerate: requireAction('export:briefing-pdf')
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const result = await generateBriefing(db, {
        storageDir: briefingStorageDir(),
        generatedBy: ctx.user.id,
      });
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'briefing.regenerated',
          payload: {
            briefingId: result.briefingId,
            format: result.format,
            bytes: result.bytes,
            durationMs: result.durationMs,
          },
        },
      });
      return {
        briefingId: result.briefingId,
        format: result.format,
        bytes: result.bytes,
        durationMs: result.durationMs,
      };
    }),
});
