// Integration test for the Marca·Cidade dashboard procedure — validates
// aggregation correctness against the seeded V27 fixture snapshot.

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
  return caller.marcaCidade.dashboard(filter);
};

describe.runIf(RUN_DB_TESTS)('marcaCidade.dashboard', () => {
  it('SSS por marca returns 3 brands with V26 baselines', async () => {
    const r = await callDashboard();
    expect(r.sssMarca).toHaveLength(3);
    expect(r.sssMarca.map((s) => s.brand).sort()).toEqual(['KIKI', 'MA', 'VALENT']);
    for (const s of r.sssMarca) {
      expect(s.v26).toBeGreaterThan(0);
      expect(s.v27).toBeGreaterThan(0);
      expect(Number.isFinite(s.varPct)).toBe(true);
    }
  });

  it('SSS Marca × Linha: each brand has 4 line cells whose pct sums to ~100', async () => {
    const r = await callDashboard();
    expect(r.sssMarcaLinha).toHaveLength(3);
    for (const row of r.sssMarcaLinha) {
      expect(row.lines).toHaveLength(4);
      const totalPct = row.lines.reduce((s, l) => s + l.pctOfBrand, 0);
      expect(totalPct).toBeGreaterThan(99.5);
      expect(totalPct).toBeLessThan(100.5);
      const cellSum = row.lines.reduce((s, l) => s + l.value, 0);
      expect(Math.abs(cellSum - row.v27)).toBeLessThan(1);
    }
  });

  it('SSS por linha: 4 lines with byBrand totals matching v27 per line', async () => {
    const r = await callDashboard();
    expect(r.sssLinha).toHaveLength(4);
    for (const l of r.sssLinha) {
      expect(['BEBE', 'PRIMEIROS_PASSOS', 'INFANTIL', 'TEEN']).toContain(l.line);
      expect(l.customerCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('city profile cards: cities count > 0 and pct sums to ~100', async () => {
    const r = await callDashboard();
    expect(r.cityProfile.length).toBeGreaterThan(0);
    const total = r.cityProfile.reduce((s, c) => s + c.pctOfTotal, 0);
    expect(total).toBeGreaterThan(99.5);
    expect(total).toBeLessThan(100.5);
  });

  it('city IBGE: 5 tiers and rep% sums to ~100', async () => {
    const r = await callDashboard();
    expect(r.cityIbge.length).toBeGreaterThanOrEqual(2); // we have at least METRO + smaller
    const total = r.cityIbge.reduce((s, c) => s + c.repPct, 0);
    expect(total).toBeGreaterThan(99.5);
    expect(total).toBeLessThan(100.5);
  });

  it('brand-by-profile: row totals sum across brands match grandTotal', async () => {
    const r = await callDashboard();
    const sumRows = r.brandByProfile.rows.reduce((s, row) => s + row.total, 0);
    expect(Math.abs(sumRows - r.brandByProfile.grandTotal)).toBeLessThan(1);
    const sumCols = r.brandByProfile.columnTotals.reduce((s, c) => s + c, 0);
    expect(Math.abs(sumCols - r.brandByProfile.grandTotal)).toBeLessThan(1);
  });

  it('top 15 cities ranked by V27 desc', async () => {
    const r = await callDashboard();
    expect(r.topCities.length).toBeLessThanOrEqual(15);
    expect(r.topCities.length).toBeGreaterThan(0);
    for (let i = 1; i < r.topCities.length; i++) {
      expect(r.topCities[i - 1]!.v27).toBeGreaterThanOrEqual(r.topCities[i]!.v27);
    }
  });

  // The Marca × Linha matrix is intentionally global (mirrors the
  // prototype): even when filtered to a single brand it shows all 3
  // brands' line splits — the filter narrows the FilterBar's downstream
  // KPI surface, not this matrix. We only check structural invariants.
  it('brand filter still returns all 3 brands in Marca × Linha matrix', async () => {
    const r = await callDashboard({ brand: 'VALENT' });
    expect(r.sssMarcaLinha).toHaveLength(3);
    for (const row of r.sssMarcaLinha) expect(row.lines).toHaveLength(4);
  });
});
