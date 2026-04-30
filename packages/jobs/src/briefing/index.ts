// Briefing public API — engine + template + PDF renderer + distribution
// + the composite generateBriefing() that runs all of them end-to-end.

import * as path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { computeBriefing, persistBriefing, type BriefingPayload, type ComputeOpts } from './engine';
import { renderBriefingHTML } from './template';
import { renderPdfFromHtml, persistBriefingArtefact } from './pdf';
import { distributeBriefing, type DistributeResult } from './distribute';

export * from './engine';
export { renderBriefingHTML } from './template';
export { renderPdfFromHtml } from './pdf';
export { distributeBriefing } from './distribute';

export interface GenerateBriefingResult {
  briefingId: string;
  payload: BriefingPayload;
  pdfPath: string;
  format: 'pdf' | 'html-fallback';
  bytes: number;
  durationMs: number;
  distribution?: DistributeResult;
}

export async function generateBriefing(
  db: PrismaClient,
  opts: ComputeOpts & {
    storageDir?: string;
    generatedBy?: string;
    /** When true, also email + post-to-Slack the payload after persisting. */
    distribute?: boolean;
    slackChannel?: string;
  } = {},
): Promise<GenerateBriefingResult> {
  const t0 = Date.now();
  const storageDir = opts.storageDir ?? defaultBriefingStorageDir();

  const payload = await computeBriefing(db, opts);
  const html = renderBriefingHTML(payload);
  const { buffer, format, bytes } = await renderPdfFromHtml(html);
  const briefing = await persistBriefing(db, payload, { generatedBy: opts.generatedBy });
  const pdfPath = await persistBriefingArtefact(buffer, format, briefing.id, storageDir);

  await db.briefingSnapshot.update({ where: { id: briefing.id }, data: { pdfPath } });

  let distribution: DistributeResult | undefined;
  if (opts.distribute) {
    distribution = await distributeBriefing(db, payload, {
      pdfPath,
      format,
      slackChannel: opts.slackChannel,
    });
  }

  return {
    briefingId: briefing.id,
    payload,
    pdfPath,
    format,
    bytes,
    durationMs: Date.now() - t0,
    distribution,
  };
}

export function defaultBriefingStorageDir(): string {
  return path.resolve(process.cwd(), 'storage', 'briefings');
}
