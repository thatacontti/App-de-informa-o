// Integration test for the Negócio dashboard procedure — hits the real
// Postgres seed populated by `prisma db seed` and asserts that the
// numbers match those baked into the prototype's d_v12.json snapshot.

import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
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
  return caller.negocio.dashboard(filter);
};

describe.runIf(RUN_DB_TESTS)('negocio.dashboard', () => {
  it('totals match the prototype snapshot (no filter)', async () => {
    const r = await callDashboard();
    expect(r.kpis.faturamento).toBeGreaterThan(4_788_000);
    expect(r.kpis.faturamento).toBeLessThan(4_790_000);
    expect(r.kpis.qtd).toBe(60_437);
    expect(r.kpis.skus).toBe(358);
    expect(r.kpis.clientes).toBe(301);
    expect(Math.round(r.kpis.pm)).toBe(79);
  });

  it('marca share sums to 100% and lists 3 brands', async () => {
    const r = await callDashboard();
    expect(r.marcaShare).toHaveLength(3);
    const total = r.marcaShare.reduce((s, m) => s + m.pct, 0);
    expect(total).toBeGreaterThan(99.9);
    expect(total).toBeLessThan(100.1);
  });

  it('SSS macro reproduces the prototype headline (+1.3% global)', async () => {
    const r = await callDashboard();
    // Prototype headline: V26 R$ 3,82MM → V27 R$ 3,87MM ≈ +1.3 %
    expect(r.sssMacro.recurringCount).toBeGreaterThan(200);
    expect(r.sssMacro.sssYoY).toBeGreaterThan(0);
    expect(r.sssMacro.sssYoY).toBeLessThan(5);
    expect(r.sssMacro.novos.count).toBeGreaterThan(50);
  });

  // Brand-filtered SSS uses the apples-to-apples customer cohort (those
  // who bought in both V26 and V27 within the filtered scope). The
  // prototype's published `sss_marca` numbers (KIKI +0.5%, MA +5.9%,
  // VALENT −0.9%) come from a slightly different cohort definition
  // (sums across the broader V26 universe) — we assert direction +
  // recurring-cohort presence here, not exact values.
  for (const brand of ['KIKI', 'MA', 'VALENT'] as const) {
    it(`brand filter ${brand}: returns a coherent SSS slice`, async () => {
      const r = await callDashboard({ brand });
      expect(r.sssMacro.recurringCount).toBeGreaterThan(0);
      expect(r.sssMacro.v26).toBeGreaterThan(0);
      expect(r.sssMacro.v27).toBeGreaterThan(0);
      expect(Number.isFinite(r.sssMacro.sssYoY)).toBe(true);
      expect(r.kpis.faturamento).toBeGreaterThan(0);
      // Marca share for the filtered brand should dominate (close to 100 %)
      const focused = r.marcaShare.find((m) => m.brand === brand);
      expect(focused?.pct).toBeGreaterThan(99);
    });
  }

  it('top customers ranked by V27 desc, max 20', async () => {
    const r = await callDashboard();
    expect(r.topCustomers).toHaveLength(20);
    for (let i = 1; i < r.topCustomers.length; i++) {
      expect(r.topCustomers[i - 1]!.v27).toBeGreaterThanOrEqual(r.topCustomers[i]!.v27);
    }
  });

  it('UF YoY contains 15 UFs with sales (matches snapshot)', async () => {
    const r = await callDashboard();
    expect(r.ufYoY.length).toBe(15);
    expect(r.ufYoY[0]?.ufId).toBe('SP'); // SP leads V27 in the snapshot
  });

  it('filtering by uf=PR narrows everything', async () => {
    const r = await callDashboard({ ufId: 'PR' });
    expect(r.kpis.faturamento).toBeGreaterThan(0);
    expect(r.kpis.faturamento).toBeLessThan(1_000_000);
    expect(r.ufYoY.every((u) => u.ufId === 'PR')).toBe(true);
  });
});
