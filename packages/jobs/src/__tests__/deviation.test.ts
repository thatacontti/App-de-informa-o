// Deviation alert test — seeds two targets (one within tolerance, one
// well over the threshold) and verifies the alert path.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { checkAndAlertDeviations } from '../alerts/deviation';

const RUN_DB_TESTS = !!process.env['DATABASE_URL'];

describe.runIf(RUN_DB_TESTS)('checkAndAlertDeviations', () => {
  const db = new PrismaClient();
  const PERIOD = 'V27-DEVIATION-TEST';

  beforeAll(async () => {
    await db.target.deleteMany({ where: { period: PERIOD } });
    await db.auditLog.deleteMany({
      where: { action: 'alert.deviation', payload: { path: ['period'], equals: PERIOD } },
    });
    // Real total faturamento V27 ≈ R$ 4.788 MM
    // Target way under (forces +deviation)
    await db.target.create({
      data: {
        scope: 'GLOBAL',
        scopeKey: PERIOD,
        period: PERIOD,
        unit: 'BRL',
        valueTarget: 1_000_000,
        valueAchieved: 0,
      },
    });
    // Target close to the realised total (within 10%)
    await db.target.create({
      data: {
        scope: 'GLOBAL',
        scopeKey: `${PERIOD}-tight`,
        period: `${PERIOD}-tight`,
        unit: 'BRL',
        valueTarget: 4_800_000,
        valueAchieved: 0,
      },
    });
  });

  afterAll(async () => {
    await db.target.deleteMany({ where: { period: { in: [PERIOD, `${PERIOD}-tight`] } } });
    await db.auditLog.deleteMany({
      where: {
        action: 'alert.deviation',
        OR: [
          { payload: { path: ['period'], equals: PERIOD } },
          { payload: { path: ['period'], equals: `${PERIOD}-tight` } },
        ],
      },
    });
    await db.$disconnect();
  });

  it('emits an alert for the wide-margin target and updates valueAchieved', async () => {
    const r = await checkAndAlertDeviations(db, { source: 'fixture' });
    expect(r.evaluated).toBeGreaterThanOrEqual(2);
    const wide = r.deviations.find((d) => d.period === PERIOD);
    expect(wide).toBeDefined();
    expect(Math.abs(wide!.deviationPct)).toBeGreaterThan(10);

    const tight = r.deviations.find((d) => d.period === `${PERIOD}-tight`);
    expect(tight).toBeUndefined();

    // Audit log was written for the wide deviation.
    const audit = await db.auditLog.findFirst({
      where: {
        action: 'alert.deviation',
        payload: { path: ['period'], equals: PERIOD },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();

    // valueAchieved was recomputed from sales.
    const updated = await db.target.findFirstOrThrow({ where: { period: PERIOD } });
    expect(Number(updated.valueAchieved)).toBeGreaterThan(0);
  });

  it('respects the cooldown — second run does not re-alert immediately', async () => {
    const before = await db.auditLog.count({
      where: { action: 'alert.deviation', payload: { path: ['period'], equals: PERIOD } },
    });
    await checkAndAlertDeviations(db, { source: 'fixture' });
    const after = await db.auditLog.count({
      where: { action: 'alert.deviation', payload: { path: ['period'], equals: PERIOD } },
    });
    expect(after).toBe(before);
  });

  it('honours a custom threshold — high threshold suppresses everything', async () => {
    const r = await checkAndAlertDeviations(db, { source: 'fixture', thresholdPct: 99_999 });
    expect(r.deviations).toHaveLength(0);
    expect(r.alertsFired).toBe(0);
  });
});
