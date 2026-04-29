import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ErpPostgresConnector, type ErpRow } from '../erp-postgres';

// Mock pg.Pool so we never actually open a TCP socket.
const queryMock = vi.fn();
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: queryMock,
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

const SAMPLE_ROW: ErpRow = {
  external_id: 'erp-42',
  product_sku: 'M4300004',
  product_name: 'MACAQUINHO',
  brand: 'MENINA ANJO',
  product_line: 'TEEN',
  product_group: 'MACAQUINHO',
  coord_season: 'RESORT 2027',
  price_tier: 'MÉDIO',
  designer: 'BRUNA',
  unit_price: '86.21',
  customer_id: '3966',
  customer_name: 'KA CONFECCOES LTDA - ME',
  customer_profile: 'REGULAR',
  rep_full_name: 'L N BANDEIRA LTDA',
  city_name: ' TOLEDO',
  uf_id: 'PR',
  qty: 7,
  value: '626.40',
  cost: '257.10',
  unit_cost: '36.7485',
  date: '2026-04-28T00:00:00Z',
  source_updated_at: '2026-04-28T12:00:00Z',
};

describe('ErpPostgresConnector · transform', () => {
  const c = new ErpPostgresConnector({ connectionString: 'postgres://x:y@localhost:5432/erp' });

  it('maps ERP row labels to enum keys', () => {
    const s = c.transform(SAMPLE_ROW);
    expect(s.brand).toBe('MA');
    expect(s.productLine).toBe('TEEN');
    expect(s.priceTier).toBe('MEDIO');
    expect(s.customerProfile).toBe('REGULAR');
  });

  it('coerces numeric strings (pg numeric → string) into numbers', () => {
    const s = c.transform(SAMPLE_ROW);
    expect(s.value).toBe(626.4);
    expect(s.cost).toBe(257.1);
    expect(s.unitCost).toBe(36.7485);
    expect(s.unitPrice).toBe(86.21);
  });

  it('trims city names and parses dates', () => {
    const s = c.transform(SAMPLE_ROW);
    expect(s.cityName).toBe('TOLEDO');
    expect(s.date).toBeInstanceOf(Date);
    expect(s.sourceUpdatedAt.toISOString()).toBe('2026-04-28T12:00:00.000Z');
  });

  it('throws ConnectorError on unknown enum labels', () => {
    expect(() => c.transform({ ...SAMPLE_ROW, brand: 'UNKNOWN' })).toThrow(/unknown brand/);
    expect(() => c.transform({ ...SAMPLE_ROW, price_tier: 'BARATO' })).toThrow(/unknown tier/);
  });
});

describe('ErpPostgresConnector · query path', () => {
  beforeEach(() => queryMock.mockReset());

  it('test() runs a SELECT 1 from the configured view', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1, n: 12345 }] });
    const c = new ErpPostgresConnector({
      connectionString: 'postgres://x:y@h/db',
      view: 'vw_painel_v27',
    });
    const r = await c.test();
    expect(r.ok).toBe(true);
    expect(r.detail).toContain('vw_painel_v27');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]![0]).toContain('vw_painel_v27');
  });

  it('test() reports failure when the view is unreachable', async () => {
    queryMock.mockRejectedValueOnce(new Error('relation "vw_painel_v27" does not exist'));
    const c = new ErpPostgresConnector({ connectionString: 'postgres://x:y@h/db' });
    const r = await c.test();
    expect(r.ok).toBe(false);
    expect(r.error).toContain('does not exist');
  });

  it('extract() passes the cutoff timestamp and maps rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [SAMPLE_ROW, { ...SAMPLE_ROW, external_id: 'erp-43' }] });
    const c = new ErpPostgresConnector({ connectionString: 'postgres://x:y@h/db' });
    const since = new Date('2026-04-01');
    const sales = await c.extract(since);
    expect(sales).toHaveLength(2);
    expect(queryMock.mock.calls[0]![1]).toEqual([since]);
    expect(sales[0]?.externalId).toBe('erp-42');
  });
});
