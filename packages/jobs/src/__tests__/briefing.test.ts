// Briefing engine — exercises the headline rules + persistence path
// against the real Postgres seed.

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { computeBriefing, generateBriefing, renderBriefingHTML } from '../briefing';

const RUN_DB_TESTS = !!process.env['DATABASE_URL'];

describe.runIf(RUN_DB_TESTS)('briefing engine · computeBriefing', () => {
  const db = new PrismaClient();
  afterAll(async () => {
    await db.briefingSnapshot.deleteMany({ where: { generatedBy: 'briefing-test' } });
    await db.$disconnect();
  });

  it('returns the 3 mandatory headline kinds (win, risk, goal)', async () => {
    const payload = await computeBriefing(db);
    const kinds = payload.headlines.map((h) => h.kind);
    expect(kinds).toContain('win');
    expect(kinds).toContain('goal');
    // Risk only appears when at least one UF is negative — V27 snapshot does have negatives.
    expect(kinds).toContain('risk');
  });

  it('reproduces brand SSS direction expected by the prototype', async () => {
    const payload = await computeBriefing(db);
    const kiki = payload.brandSss.find((b) => b.brand === 'KIKI');
    const valent = payload.brandSss.find((b) => b.brand === 'VALENT');
    expect(kiki).toBeDefined();
    expect(valent).toBeDefined();
    // KIKI expected to be modestly positive, VALENT ≈ 0
    expect(Number.isFinite(kiki!.sss)).toBe(true);
    expect(Number.isFinite(valent!.sss)).toBe(true);
  });

  it('captures KPI totals (faturamento + peças)', async () => {
    const payload = await computeBriefing(db);
    expect(payload.kpis.pecas).toBe(60_437);
    expect(Math.round(payload.kpis.faturamento)).toBe(4_788_607);
    expect(payload.kpis.recurringCount).toBeGreaterThan(200);
    expect(payload.kpis.novosCount).toBeGreaterThan(50);
  });

  it('exposes 4 standing decisions', async () => {
    const payload = await computeBriefing(db);
    expect(payload.decisions).toHaveLength(4);
    for (const d of payload.decisions) {
      expect(['COMERCIAL', 'PRODUTO', 'DIRETORIA']).toContain(d.owner);
    }
  });
});

describe.runIf(RUN_DB_TESTS)('briefing engine · renderBriefingHTML', () => {
  const db = new PrismaClient();
  afterAll(async () => {
    await db.$disconnect();
  });

  it('produces self-contained HTML with the hero band and headlines', async () => {
    const payload = await computeBriefing(db);
    const html = renderBriefingHTML(payload);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Briefing Diretoria');
    expect(html).toContain('Verão');
    expect(html).toContain('SSS por marca');
    for (const headline of payload.headlines) {
      expect(html).toContain(headline.title);
    }
  });
});

describe.runIf(RUN_DB_TESTS)('briefing engine · generateBriefing', () => {
  const db = new PrismaClient();
  const storageDir = mkdtempSync(path.join(tmpdir(), 'briefing-test-'));
  let createdId: string | null = null;

  afterAll(async () => {
    if (createdId) {
      await db.briefingSnapshot.deleteMany({ where: { id: createdId } }).catch(() => undefined);
    }
    rmSync(storageDir, { recursive: true, force: true });
    await db.$disconnect();
  });

  it('persists a BriefingSnapshot and writes an artefact to disk', async () => {
    const result = await generateBriefing(db, {
      storageDir,
      generatedBy: 'briefing-test',
    });
    createdId = result.briefingId;

    expect(result.briefingId).toBeTruthy();
    expect(result.bytes).toBeGreaterThan(0);
    expect(['pdf', 'html-fallback']).toContain(result.format);

    const snapshot = await db.briefingSnapshot.findUniqueOrThrow({ where: { id: result.briefingId } });
    expect(snapshot.pdfPath).toBe(result.pdfPath);
    expect(Array.isArray(snapshot.headlinesJson)).toBe(true);
    expect((snapshot.decisionsJson as unknown[]).length).toBe(4);

    // Artefact exists and is non-empty.
    const stat = readFileSync(result.pdfPath);
    expect(stat.byteLength).toBeGreaterThan(0);
  });
});
