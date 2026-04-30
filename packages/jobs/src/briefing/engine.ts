// Briefing engine — turns the current state of the warehouse into the
// shape consumed by the PDF template and the Slack/email digest:
//
//   headlines: 3 deterministic rules (biggest YoY win, biggest risk,
//              target attainment).
//   risks:     ranked list of UFs and brands missing target by >10 %.
//   decisions: standing recommendations the diretoria reviews each week.
//   kpis:      headline figures (faturamento, peças, SSS, attainment).
//
// All numbers come from the same fact-table the dashboards read, so
// the briefing PDF can be reconciled against the live UI.

import type { Brand, PrismaClient } from '@prisma/client';

export interface Headline {
  kind: 'win' | 'risk' | 'goal';
  title: string;
  value: string;
  detail: string;
}

export interface Risk {
  scope: 'BRAND' | 'UF';
  scopeKey: string;
  shortfallPct: number;
  shortfallValue: number;
  detail: string;
}

export interface Decision {
  action: string;
  owner: 'COMERCIAL' | 'PRODUTO' | 'DIRETORIA';
  due: string;
}

export interface KpiPayload {
  faturamento: number;
  pecas: number;
  pm: number;
  sssYoY: number;
  recurringCount: number;
  novosCount: number;
  globalAttainmentPct: number;
}

export interface BriefingPayload {
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  kpis: KpiPayload;
  headlines: Headline[];
  risks: Risk[];
  decisions: Decision[];
  brandSss: Array<{ brand: Brand; v26: number; v27: number; sss: number }>;
  ufRisks: Array<{ ufId: string; v26: number; v27: number; sss: number; targetPct: number }>;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const STANDING_DECISIONS: Decision[] = [
  {
    action: 'Reposição automática dos SKUs Classe A com cobertura ≥ 50%',
    owner: 'PRODUTO',
    due: 'sexta-feira',
  },
  {
    action: 'Revisão de SKUs Curva C — corte ou re-precificação para V28',
    owner: 'PRODUTO',
    due: 'próxima reunião de mix',
  },
  {
    action: 'Plano de ação por UF abaixo de -20% SSS',
    owner: 'COMERCIAL',
    due: 'esta semana',
  },
  {
    action: 'Acompanhamento dos NOVO 27 — onboarding e segundo pedido',
    owner: 'COMERCIAL',
    due: 'até final do mês',
  },
];

export interface ComputeOpts {
  /** Period the snapshot covers — defaults to the V27 collection window. */
  periodStart?: Date;
  periodEnd?: Date;
  /** Source filter (mirror of seed → 'fixture' in dev). */
  source?: string;
}

export async function computeBriefing(
  db: PrismaClient,
  opts: ComputeOpts = {},
): Promise<BriefingPayload> {
  const periodStart = opts.periodStart ?? new Date('2026-04-01');
  const periodEnd = opts.periodEnd ?? new Date('2026-04-28');
  const source = opts.source ?? 'fixture';

  // Sales in scope
  const sales = await db.sale.findMany({
    where: { source, date: { gte: periodStart, lte: periodEnd } },
    select: {
      customerId: true,
      brand: true,
      ufId: true,
      qty: true,
      value: true,
    },
  });

  const v26Rows = await db.customerBrandRevenue.findMany({
    where: { period: 'V26' },
    select: { customerId: true, brand: true, value: true },
  });
  const V26M = new Map<string, Partial<Record<Brand, number>>>();
  for (const r of v26Rows) {
    const m = V26M.get(r.customerId) ?? {};
    m[r.brand] = Number(r.value);
    V26M.set(r.customerId, m);
  }

  // Brand SSS (recurring cohort, apples-to-apples)
  const recurring = new Set<string>();
  for (const s of sales) if (V26M.has(s.customerId)) recurring.add(s.customerId);
  const brandSss = (['KIKI', 'MA', 'VALENT'] as const).map((brand) => {
    let v26 = 0;
    let v27 = 0;
    for (const cid of recurring) v26 += V26M.get(cid)?.[brand] ?? 0;
    for (const s of sales) if (s.brand === brand && recurring.has(s.customerId)) v27 += Number(s.value);
    const sss = v26 ? ((v27 - v26) / v26) * 100 : 0;
    return { brand: brand as Brand, v26, v27, sss };
  });

  // UF SSS
  const cidByUf = new Map<string, string>();
  for (const s of sales) cidByUf.set(s.customerId, s.ufId);
  const ufV26 = new Map<string, number>();
  const ufV27Recurring = new Map<string, number>();
  for (const [cid, uf] of cidByUf) {
    const m = V26M.get(cid);
    if (!m) continue;
    const total = Object.values(m).reduce((a, v) => a + (v ?? 0), 0);
    ufV26.set(uf, (ufV26.get(uf) ?? 0) + total);
  }
  for (const s of sales) {
    if (!V26M.has(s.customerId)) continue;
    ufV27Recurring.set(s.ufId, (ufV27Recurring.get(s.ufId) ?? 0) + Number(s.value));
  }
  const ufRows = [...new Set(sales.map((s) => s.ufId))].map((ufId) => {
    const v26 = ufV26.get(ufId) ?? 0;
    const v27 = ufV27Recurring.get(ufId) ?? 0;
    const sss = v26 ? ((v27 - v26) / v26) * 100 : 0;
    return { ufId, v26, v27, sss };
  });

  // KPIs
  const faturamento = sales.reduce((s, r) => s + Number(r.value), 0);
  const pecas = sales.reduce((s, r) => s + r.qty, 0);
  const novosCount = new Set(sales.filter((s) => !V26M.has(s.customerId)).map((s) => s.customerId)).size;
  const macroV26 = brandSss.reduce((s, b) => s + b.v26, 0);
  const macroV27 = brandSss.reduce((s, b) => s + b.v27, 0);
  const sssYoY = macroV26 ? ((macroV27 - macroV26) / macroV26) * 100 : 0;

  // Targets — global BRL/V27
  const target = await db.target.findFirst({
    where: { scope: 'GLOBAL', scopeKey: 'V27', period: 'V27', unit: 'BRL' },
    select: { valueTarget: true, valueAchieved: true },
  });
  const targetValue = target ? Number(target.valueTarget) : 0;
  const globalAttainmentPct = targetValue ? (faturamento / targetValue) * 100 : 0;

  const ufRisks = ufRows
    .map((u) => ({ ...u, targetPct: u.sss }))
    .filter((u) => u.sss < -10)
    .sort((a, b) => a.sss - b.sss)
    .slice(0, 5);

  // ---- Headlines (3 rules) ----
  const headlines: Headline[] = [];

  // Rule 1: biggest brand YoY win
  const winningBrand = [...brandSss].sort((a, b) => b.sss - a.sss)[0];
  if (winningBrand) {
    headlines.push({
      kind: 'win',
      title: `${labelOf(winningBrand.brand)} lidera o crescimento`,
      value: fmtPct(winningBrand.sss),
      detail: `V26 ${fmtBRL(winningBrand.v26)} → V27 ${fmtBRL(winningBrand.v27)} (mesma carteira)`,
    });
  }

  // Rule 2: biggest UF risk in absolute value (largest drop)
  const worstUf = ufRows.sort((a, b) => a.sss - b.sss)[0];
  if (worstUf && worstUf.sss < 0) {
    headlines.push({
      kind: 'risk',
      title: `Risco em ${worstUf.ufId}`,
      value: fmtPct(worstUf.sss),
      detail: `V26 ${fmtBRL(worstUf.v26)} → V27 ${fmtBRL(worstUf.v27)} · diferença ${fmtBRL(worstUf.v27 - worstUf.v26)}`,
    });
  }

  // Rule 3: target attainment
  headlines.push({
    kind: 'goal',
    title: 'Atingimento da meta V27',
    value: `${globalAttainmentPct.toFixed(1)}%`,
    detail: targetValue
      ? `${fmtBRL(faturamento)} de ${fmtBRL(targetValue)} (preview comercial até ${formatDate(periodEnd)})`
      : `Meta global ainda não cadastrada`,
  });

  // Risks
  const risks: Risk[] = [];
  for (const b of brandSss) {
    if (b.sss < -5) {
      risks.push({
        scope: 'BRAND',
        scopeKey: labelOf(b.brand),
        shortfallPct: b.sss,
        shortfallValue: b.v27 - b.v26,
        detail: `${labelOf(b.brand)}: SSS ${fmtPct(b.sss)} (V26 ${fmtBRL(b.v26)} → V27 ${fmtBRL(b.v27)})`,
      });
    }
  }
  for (const u of ufRisks) {
    risks.push({
      scope: 'UF',
      scopeKey: u.ufId,
      shortfallPct: u.sss,
      shortfallValue: u.v27 - u.v26,
      detail: `${u.ufId}: SSS ${fmtPct(u.sss)} (V26 ${fmtBRL(u.v26)} → V27 ${fmtBRL(u.v27)})`,
    });
  }

  return {
    generatedAt: new Date(),
    periodStart,
    periodEnd,
    kpis: {
      faturamento,
      pecas,
      pm: pecas ? faturamento / pecas : 0,
      sssYoY,
      recurringCount: recurring.size,
      novosCount,
      globalAttainmentPct,
    },
    headlines,
    risks,
    decisions: STANDING_DECISIONS,
    brandSss,
    ufRisks,
  };
}

export async function persistBriefing(
  db: PrismaClient,
  payload: BriefingPayload,
  opts: { generatedBy?: string; pdfPath?: string } = {},
) {
  return db.briefingSnapshot.create({
    data: {
      generatedAt: payload.generatedAt,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      headlinesJson: payload.headlines as never,
      risksJson: payload.risks as never,
      decisionsJson: payload.decisions as never,
      pdfPath: opts.pdfPath ?? null,
      generatedBy: opts.generatedBy ?? null,
    },
  });
}

function labelOf(b: Brand): string {
  if (b === 'KIKI') return 'KIKI';
  if (b === 'MA') return 'MENINA ANJO';
  return 'VALENT';
}

function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mmNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mm = mmNames[d.getUTCMonth()];
  return `${dd}/${mm}`;
}
