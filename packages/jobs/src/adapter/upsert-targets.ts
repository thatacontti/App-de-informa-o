// Targets adapter — turns NormalizedTarget[] into Postgres rows.
// Idempotent on the unique (scope, scopeKey, period, unit) tuple.

import type { Prisma, PrismaClient } from '@prisma/client';
import type { NormalizedTarget } from '@painel/connectors';

export interface UpsertTargetsResult {
  recordsIn: number;
  recordsOut: number;
}

export async function upsertTargets(
  db: PrismaClient,
  targets: NormalizedTarget[],
): Promise<UpsertTargetsResult> {
  if (targets.length === 0) return { recordsIn: 0, recordsOut: 0 };

  const ops: Prisma.PrismaPromise<unknown>[] = targets.map((t) => {
    // GLOBAL scope has no natural key, so we synthesise one from the period.
    const scopeKey = t.scopeKey ?? t.period;
    const data = {
      scope: t.scope,
      scopeKey,
      brand: t.brand,
      ufId: t.ufId,
      period: t.period,
      unit: t.unit,
      valueTarget: t.valueTarget,
    };
    return db.target.upsert({
      where: {
        scope_scopeKey_period_unit: {
          scope: t.scope,
          scopeKey,
          period: t.period,
          unit: t.unit,
        },
      },
      update: data,
      create: data,
    });
  });

  await db.$transaction(ops);
  return { recordsIn: targets.length, recordsOut: targets.length };
}
