// Briefing public API — engine + template + PDF renderer + the
// composite generateBriefing() that runs all three end-to-end.

import * as path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { computeBriefing, persistBriefing, type BriefingPayload, type ComputeOpts } from './engine';
import { renderBriefingHTML } from './template';
import { renderPdfFromHtml, persistBriefingArtefact } from './pdf';

export * from './engine';
export { renderBriefingHTML } from './template';
export { renderPdfFromHtml } from './pdf';

export interface GenerateBriefingResult {
  briefingId: string;
  payload: BriefingPayload;
  pdfPath: string;
  format: 'pdf' | 'html-fallback';
  bytes: number;
  durationMs: number;
}

export async function generateBriefing(
  db: PrismaClient,
  opts: ComputeOpts & {
    storageDir?: string;
    generatedBy?: string;
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

  return {
    briefingId: briefing.id,
    payload,
    pdfPath,
    format,
    bytes,
    durationMs: Date.now() - t0,
  };
}

export function defaultBriefingStorageDir(): string {
  return path.resolve(process.cwd(), 'storage', 'briefings');
}
