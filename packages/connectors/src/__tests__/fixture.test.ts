// Integration test — runs against the real painel_v27/*.json fixtures.
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { FixtureSaleConnector, FixtureTargetConnector } from '../fixture';

const FIXTURES_DIR = path.resolve(__dirname, '../../../..', 'painel_v27');
const EPOCH = new Date(0);

describe('FixtureSaleConnector', () => {
  it('test() succeeds when fixture file exists', async () => {
    const c = new FixtureSaleConnector({ type: 'ERP_DB', fixturesDir: FIXTURES_DIR });
    const r = await c.test();
    expect(r.ok).toBe(true);
    expect(r.detail).toContain('fixture');
  });

  it('test() fails for a missing fixtures dir', async () => {
    const c = new FixtureSaleConnector({ type: 'ERP_DB', fixturesDir: '/no/such/path' });
    const r = await c.test();
    expect(r.ok).toBe(false);
    expect(r.error).toContain('fixture missing');
  });

  it('extract() returns 14 837 normalised sales for the V27 snapshot', async () => {
    const c = new FixtureSaleConnector({ type: 'ERP_DB', fixturesDir: FIXTURES_DIR });
    const sales = await c.extract(EPOCH);
    expect(sales).toHaveLength(14837);

    const totalValue = sales.reduce((s, x) => s + x.value, 0);
    const totalQty = sales.reduce((s, x) => s + x.qty, 0);
    expect(Math.round(totalValue)).toBe(4_788_607);
    expect(totalQty).toBe(60437);

    const skus = new Set(sales.map((s) => s.productSku));
    expect(skus.size).toBe(358);
    const customers = new Set(sales.map((s) => s.customerId));
    expect(customers.size).toBe(301);

    const brands = new Set(sales.map((s) => s.brand));
    expect(brands).toEqual(new Set(['KIKI', 'MA', 'VALENT']));

    const tiers = new Set(sales.map((s) => s.priceTier));
    expect(tiers).toEqual(new Set(['ENTRADA', 'MEDIO', 'PREMIUM']));
  });

  it('extract() returns nothing when the cutoff is past the snapshot', async () => {
    const c = new FixtureSaleConnector({ type: 'ERP_DB', fixturesDir: FIXTURES_DIR });
    const future = new Date('2030-01-01');
    expect(await c.extract(future)).toEqual([]);
  });
});

describe('FixtureTargetConnector', () => {
  it('extract() emits 1 GLOBAL + 3 BRAND + N UF targets', async () => {
    const c = new FixtureTargetConnector({ fixturesDir: FIXTURES_DIR });
    const targets = await c.extract();

    const byScope = (s: 'GLOBAL' | 'BRAND' | 'UF') => targets.filter((t) => t.scope === s);
    expect(byScope('GLOBAL')).toHaveLength(1);
    expect(byScope('BRAND')).toHaveLength(3);
    expect(byScope('UF').length).toBeGreaterThanOrEqual(15);

    for (const t of targets) {
      expect(t.unit).toBe('BRL');
      expect(t.period).toBe('V27');
      expect(t.valueTarget).toBeGreaterThan(0);
    }
  });
});
