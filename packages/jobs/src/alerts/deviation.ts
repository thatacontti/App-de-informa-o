// Real-time deviation alerts.
//
// After every successful sync, recompute Target.valueAchieved for every
// active target and compare against valueTarget. When the absolute
// deviation crosses the threshold (default 10%), post a Slack alert.
//
// To avoid spam, only emit an alert if the most recent
// `alert.deviation` AuditLog entry for the same scope+key+period is
// older than the configured cooldown (default 24h).

import type { PrismaClient } from '@prisma/client';
import { postSlack } from '../notifications/slack';

const DEFAULT_THRESHOLD = 10;
const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export interface DeviationOptions {
  thresholdPct?: number;
  cooldownMs?: number;
  slackChannel?: string;
  source?: string;
}

export interface TargetDeviation {
  targetId: string;
  scope: 'GLOBAL' | 'BRAND' | 'UF' | 'REP';
  scopeKey: string;
  period: string;
  valueTarget: number;
  valueAchieved: number;
  deviationPct: number;
}

export interface DeviationCheckResult {
  evaluated: number;
  deviations: TargetDeviation[];
  alertsFired: number;
}

export async function checkAndAlertDeviations(
  db: PrismaClient,
  opts: DeviationOptions = {},
): Promise<DeviationCheckResult> {
  const threshold = opts.thresholdPct ?? DEFAULT_THRESHOLD;
  const cooldown = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const source = opts.source ?? 'fixture';

  const targets = await db.target.findMany();
  const now = new Date();
  const evaluated: TargetDeviation[] = [];
  const deviations: TargetDeviation[] = [];

  for (const t of targets) {
    const scopeKey = t.scopeKey ?? t.period;
    const achieved = await recomputeAchieved(db, source, { ...t, scopeKey });
    if (achieved !== Number(t.valueAchieved)) {
      await db.target.update({
        where: { id: t.id },
        data: { valueAchieved: achieved },
      });
    }
    const valueTarget = Number(t.valueTarget);
    if (valueTarget <= 0) continue;
    const deviationPct = ((achieved - valueTarget) / valueTarget) * 100;
    const dev: TargetDeviation = {
      targetId: t.id,
      scope: t.scope,
      scopeKey,
      period: t.period,
      valueTarget,
      valueAchieved: achieved,
      deviationPct,
    };
    evaluated.push(dev);
    if (Math.abs(deviationPct) >= threshold) deviations.push(dev);
  }

  let alertsFired = 0;
  for (const d of deviations) {
    const recent = await db.auditLog.findFirst({
      where: {
        action: 'alert.deviation',
        createdAt: { gte: new Date(now.getTime() - cooldown) },
        AND: [
          { payload: { path: ['scope'], equals: d.scope } },
          { payload: { path: ['scopeKey'], equals: d.scopeKey } },
          { payload: { path: ['period'], equals: d.period } },
        ],
      },
      select: { id: true },
    });
    if (recent) continue;

    const sign = d.deviationPct >= 0 ? 'acima' : 'abaixo';
    const text = `:rotating_light: *Desvio ${fmtPct(d.deviationPct)} ${sign} da meta* — ${labelOfTarget(d)} · meta ${fmtBRL(d.valueTarget)} · realizado ${fmtBRL(d.valueAchieved)}`;
    const slackResult = await postSlack({ channel: opts.slackChannel, text }).catch(() => ({ delivered: false }));
    await db.auditLog.create({
      data: {
        action: 'alert.deviation',
        payload: {
          targetId: d.targetId,
          scope: d.scope,
          scopeKey: d.scopeKey,
          period: d.period,
          deviationPct: d.deviationPct,
          valueTarget: d.valueTarget,
          valueAchieved: d.valueAchieved,
          slackDelivered: slackResult.delivered,
        },
      },
    });
    alertsFired++;
  }

  return {
    evaluated: evaluated.length,
    deviations,
    alertsFired,
  };
}

async function recomputeAchieved(
  db: PrismaClient,
  source: string,
  t: {
    scope: 'GLOBAL' | 'BRAND' | 'UF' | 'REP';
    scopeKey: string;
    brand: string | null;
    ufId: string | null;
    repId: string | null;
  },
): Promise<number> {
  const where: Record<string, unknown> = { source };
  switch (t.scope) {
    case 'BRAND':
      if (t.brand) where['brand'] = t.brand;
      else if (t.scopeKey) where['brand'] = t.scopeKey;
      break;
    case 'UF':
      where['ufId'] = t.ufId ?? t.scopeKey;
      break;
    case 'REP':
      where['repId'] = t.repId ?? t.scopeKey;
      break;
    case 'GLOBAL':
    default:
      // No additional filter — sums every sale for the source.
      break;
  }
  const r = await db.sale.aggregate({ where, _sum: { value: true } });
  return Number(r._sum.value ?? 0);
}

function labelOfTarget(t: TargetDeviation): string {
  if (t.scope === 'GLOBAL') return `meta GLOBAL · ${t.period}`;
  return `${t.scope} ${t.scopeKey} · ${t.period}`;
}
