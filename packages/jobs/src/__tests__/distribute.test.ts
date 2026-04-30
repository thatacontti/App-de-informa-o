// Briefing distribution test — uses the real Slack/email helpers in
// their no-op mode (no SLACK_BOT_TOKEN, no SMTP creds) so we exercise
// the orchestration without touching the network.

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { computeBriefing, distributeBriefing, generateBriefing } from '../briefing';

const RUN_DB_TESTS = !!process.env['DATABASE_URL'];

describe.runIf(RUN_DB_TESTS)('distributeBriefing', () => {
  const db = new PrismaClient();
  afterAll(async () => {
    await db.$disconnect();
  });

  it('returns recipient count and reports delivered=false in noop mode', async () => {
    const payload = await computeBriefing(db);
    const r = await distributeBriefing(db, payload);
    // 3 seed users (admin + gestor) — analista is excluded.
    expect(r.email.recipients).toBeGreaterThanOrEqual(2);
    expect(r.email.delivered).toBe(false); // jsonTransport / noop
    expect(r.slack.delivered).toBe(false); // SLACK_BOT_TOKEN missing
  });
});

describe.runIf(RUN_DB_TESTS)('generateBriefing · with distribute=true', () => {
  const db = new PrismaClient();
  const storageDir = mkdtempSync(path.join(tmpdir(), 'briefing-dist-'));
  let createdId: string | null = null;

  afterAll(async () => {
    if (createdId) {
      await db.briefingSnapshot.deleteMany({ where: { id: createdId } }).catch(() => undefined);
    }
    rmSync(storageDir, { recursive: true, force: true });
    await db.$disconnect();
  });

  it('runs the full pipeline and surfaces the distribution result', async () => {
    const r = await generateBriefing(db, { storageDir, distribute: true });
    createdId = r.briefingId;
    expect(r.distribution).toBeDefined();
    expect(r.distribution!.email.recipients).toBeGreaterThan(0);
  });
});
