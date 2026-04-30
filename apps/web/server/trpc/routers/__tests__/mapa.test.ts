import { describe, expect, it } from 'vitest';
import { appRouter } from '../../router';
import type { Filter, Brand } from '@painel/shared';
import type { Session } from 'next-auth';

const RUN_DB_TESTS = !!process.env['DATABASE_URL'];

const adminSession: Session = {
  user: { id: 'tester', email: 'admin@catarina.local', name: 'Admin', role: 'ADMIN' },
  expires: new Date(Date.now() + 8 * 3600_000).toISOString(),
} as Session;

const callDashboard = (filter: Filter = {}) => {
  const caller = appRouter.createCaller({ session: adminSession });
  return caller.mapa.dashboard(filter);
};

describe.runIf(RUN_DB_TESTS)('mapa.dashboard', () => {
  it('KPIs match the V27 snapshot totals', async () => {
    const r = await callDashboard();
    expect(r.kpis.totalSkus).toBe(358);
    expect(r.kpis.totalQty).toBe(60_437);
  });

  it('exposes 6 PM faixas in the prescribed order', async () => {
    const r = await callDashboard();
    expect(r.faixas).toEqual(['00-50', '50-70', '70-90', '90-110', '110-130', '130+']);
  });

  it('Mapa 1 covers all 3 brands and preserves SKU totals', async () => {
    const r = await callDashboard();
    expect(r.map1).toHaveLength(3);
    const seen = new Set<Brand>();
    let totalSkus = 0;
    for (const b of r.map1) {
      seen.add(b.brand);
      let countedFromCells = 0;
      for (const ln of b.lines) for (const f of ln.faixas) countedFromCells += f.cards.length;
      expect(countedFromCells).toBe(b.skuCount);
      totalSkus += b.skuCount;
    }
    expect(seen).toEqual(new Set<Brand>(['KIKI', 'MA', 'VALENT']));
    expect(totalSkus).toBe(r.kpis.totalSkus);
  });

  it('Mapa 2 groups tipos sorted by qty desc inside each line', async () => {
    const r = await callDashboard();
    for (const b of r.map2) {
      for (const ln of b.lines) {
        // each tipo's qty is the sum of its faixa cards' qty
        const tiposQty = ln.tipos.map((t) =>
          t.faixas.reduce((s, f) => s + f.cards.reduce((q, c) => q + c.qty, 0), 0),
        );
        for (let i = 1; i < tiposQty.length; i++) {
          expect(tiposQty[i - 1]).toBeGreaterThanOrEqual(tiposQty[i]!);
        }
      }
    }
  });

  it('cards inside a faixa are sorted by PM ascending', async () => {
    const r = await callDashboard();
    for (const b of r.map1) {
      for (const ln of b.lines) {
        for (const f of ln.faixas) {
          for (let i = 1; i < f.cards.length; i++) {
            expect(f.cards[i - 1]!.pm).toBeLessThanOrEqual(f.cards[i]!.pm);
          }
        }
      }
    }
  });

  it('brand filter narrows both maps to the chosen brand', async () => {
    const r = await callDashboard({ brand: 'KIKI' });
    expect(r.map1.every((b) => b.brand === 'KIKI')).toBe(true);
    expect(r.map2.every((b) => b.brand === 'KIKI')).toBe(true);
  });

  it('every PM falls inside one of the 6 faixas (no SKU drops)', async () => {
    const r = await callDashboard();
    const FAIXA_RANGE: Record<string, [number, number]> = {
      '00-50': [0, 50],
      '50-70': [50, 70],
      '70-90': [70, 90],
      '90-110': [90, 110],
      '110-130': [110, 130],
      '130+': [130, 99_999],
    };
    for (const b of r.map1) {
      for (const ln of b.lines) {
        for (const f of ln.faixas) {
          const [lo, hi] = FAIXA_RANGE[f.label]!;
          for (const c of f.cards) {
            expect(c.pm).toBeGreaterThanOrEqual(lo);
            expect(c.pm).toBeLessThan(hi);
          }
        }
      }
    }
  });
});
