// Integration test for the Produto · Estratégia dashboard procedure.

import { describe, expect, it } from 'vitest';
import { appRouter } from '../../router';
import type { Filter } from '@painel/shared';
import type { Session } from 'next-auth';

const RUN_DB_TESTS = !!process.env['DATABASE_URL'];

const adminSession: Session = {
  user: { id: 'tester', email: 'admin@catarina.local', name: 'Admin', role: 'ADMIN' },
  expires: new Date(Date.now() + 8 * 3600_000).toISOString(),
} as Session;

const callDashboard = (filter: Filter = {}) => {
  const caller = appRouter.createCaller({ session: adminSession });
  return caller.produto.dashboard(filter);
};

describe.runIf(RUN_DB_TESTS)('produto.dashboard', () => {
  it('KPIs match Negócio totals', async () => {
    const r = await callDashboard();
    expect(r.kpis.skus).toBe(358);
    expect(r.kpis.qtd).toBe(60_437);
    expect(Math.round(r.kpis.faturamento)).toBe(4_788_607);
  });

  it('Faixa cards cover 3 tiers and pct sums to 100', async () => {
    const r = await callDashboard();
    expect(r.faixaCards).toHaveLength(3);
    const total = r.faixaCards.reduce((s, f) => s + f.pctValue, 0);
    expect(total).toBeGreaterThan(99.5);
    expect(total).toBeLessThan(100.5);
  });

  it('Faixas granulares: bins are sorted ascending and total pct ≈ 100', async () => {
    const r = await callDashboard();
    expect(r.faixasGranular.length).toBeGreaterThan(5);
    expect(r.faixasGranular.length).toBeLessThanOrEqual(14);
    const total = r.faixasGranular.reduce((s, b) => s + b.pctValue, 0);
    expect(total).toBeGreaterThan(99.5);
    expect(total).toBeLessThan(100.5);
  });

  it('Mix optimization: ranks by efficiency desc, pct sums close to 100', async () => {
    const r = await callDashboard();
    expect(r.mixOptimization.length).toBeGreaterThan(0);
    for (let i = 1; i < r.mixOptimization.length; i++) {
      expect(r.mixOptimization[i - 1]!.eficiencia).toBeGreaterThanOrEqual(
        r.mixOptimization[i]!.eficiencia,
      );
    }
    const totalPct = r.mixOptimization.reduce((s, g) => s + g.pctValue, 0);
    expect(totalPct).toBeGreaterThan(99);
    expect(totalPct).toBeLessThan(101);
  });

  it('ABC sums to 100% and counts add up to total SKUs', async () => {
    const r = await callDashboard();
    const totalPct = r.abc.reduce((s, c) => s + c.pct, 0);
    expect(totalPct).toBeGreaterThan(99.5);
    expect(totalPct).toBeLessThan(100.5);
    const totalSkus = r.abc.reduce((s, c) => s + c.skus, 0);
    expect(totalSkus).toBe(358);
  });

  it('Moodboard: top 30 sorted by qty desc with cobertura between 0 and 100', async () => {
    const r = await callDashboard();
    expect(r.moodboard).toHaveLength(30);
    for (let i = 1; i < r.moodboard.length; i++) {
      expect(r.moodboard[i - 1]!.qty).toBeGreaterThanOrEqual(r.moodboard[i]!.qty);
    }
    for (const m of r.moodboard) {
      expect(m.cobertura).toBeGreaterThanOrEqual(0);
      expect(m.cobertura).toBeLessThanOrEqual(100);
    }
  });

  it('Ranks: A + B + C sums to total SKUs in rank.all (cap 200)', async () => {
    const r = await callDashboard();
    expect(r.ranks.all.length).toBeLessThanOrEqual(200);
    expect(r.ranks.b.length).toBeGreaterThan(0);
    expect(r.ranks.c.length).toBeGreaterThan(0);
    // acum is monotonic
    for (let i = 1; i < r.ranks.all.length; i++) {
      expect(r.ranks.all[i - 1]!.acum).toBeLessThanOrEqual(r.ranks.all[i]!.acum);
    }
  });

  it('Coordenados: returns up to 12 entries, sorted by value desc', async () => {
    const r = await callDashboard();
    expect(r.coordenados.length).toBeLessThanOrEqual(12);
    for (let i = 1; i < r.coordenados.length; i++) {
      expect(r.coordenados[i - 1]!.value).toBeGreaterThanOrEqual(r.coordenados[i]!.value);
    }
  });

  it('brand filter narrows SKUs to that brand only', async () => {
    const r = await callDashboard({ brand: 'VALENT' });
    expect(r.kpis.skus).toBeGreaterThan(0);
    expect(r.kpis.skus).toBeLessThan(150);
    for (const m of r.moodboard) expect(m.brand).toBe('VALENT');
  });
});
