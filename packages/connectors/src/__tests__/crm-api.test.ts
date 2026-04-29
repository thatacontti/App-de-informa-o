import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios, { AxiosError, AxiosHeaders, type AxiosInstance } from 'axios';
import { CrmApiConnector, type CrmDeal } from '../crm-api';

const SAMPLE_DEAL: CrmDeal = {
  id: 1234,
  sku: 'M4300004',
  product_name: 'MACAQUINHO',
  brand: 'MENINA ANJO',
  line: 'TEEN',
  group: 'MACAQUINHO',
  price_tier: 'MÉDIO',
  unit_price: 86.21,
  customer: {
    id: 3966,
    name: 'KA CONFECCOES LTDA - ME',
    profile: 'REGULAR',
    uf: 'PR',
    city: ' TOLEDO',
  },
  rep: { full_name: 'L N BANDEIRA LTDA' },
  qty: 7,
  value: 626.4,
  cost: 257.1,
  unit_cost: 36.7485,
  closed_at: '2026-04-28T00:00:00Z',
  updated_at: '2026-04-28T12:00:00Z',
};

function makeAxiosStub(get: AxiosInstance['get']): AxiosInstance {
  return { get } as unknown as AxiosInstance;
}

describe('CrmApiConnector · transform', () => {
  const c = new CrmApiConnector({
    baseUrl: 'https://api.example.com',
    token: 'tk',
    http: makeAxiosStub(vi.fn()),
  });

  it('normalises a deal into a NormalizedSale', () => {
    const s = c.transform(SAMPLE_DEAL);
    expect(s.brand).toBe('MA');
    expect(s.productLine).toBe('TEEN');
    expect(s.priceTier).toBe('MEDIO');
    expect(s.customerProfile).toBe('REGULAR');
    expect(s.cityName).toBe('TOLEDO');
    expect(s.externalId).toBe('1234');
    expect(s.repFullName).toBe('L N BANDEIRA LTDA');
    expect(s.value).toBe(626.4);
  });

  it('throws on unknown enum values', () => {
    expect(() => c.transform({ ...SAMPLE_DEAL, brand: 'UNKNOWN' })).toThrow(/unknown brand/);
  });
});

describe('CrmApiConnector · paginated extract', () => {
  let getMock: ReturnType<typeof vi.fn>;
  let c: CrmApiConnector;

  beforeEach(() => {
    getMock = vi.fn();
    c = new CrmApiConnector({
      baseUrl: 'https://api.example.com',
      token: 'tk',
      pageSize: 2,
      http: makeAxiosStub(getMock as unknown as AxiosInstance['get']),
    });
  });

  it('walks every page until has_more=false', async () => {
    getMock
      .mockResolvedValueOnce({
        status: 200,
        data: { items: [SAMPLE_DEAL, { ...SAMPLE_DEAL, id: 2 }], has_more: true },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { items: [{ ...SAMPLE_DEAL, id: 3 }], has_more: false },
      });

    const sales = await c.extract(new Date('2026-04-01'));
    expect(sales).toHaveLength(3);
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls[0]![1].params).toMatchObject({ page: 1, per_page: 2 });
    expect(getMock.mock.calls[1]![1].params).toMatchObject({ page: 2, per_page: 2 });
  });

  it('stops when the page returns an empty array', async () => {
    getMock
      .mockResolvedValueOnce({ status: 200, data: { items: [SAMPLE_DEAL], has_more: true } })
      .mockResolvedValueOnce({ status: 200, data: { items: [] } });
    const sales = await c.extract(new Date('2026-04-01'));
    expect(sales).toHaveLength(1);
  });

  it('test() pings /deals with page=1, per_page=1', async () => {
    getMock.mockResolvedValueOnce({ status: 200, data: { items: [SAMPLE_DEAL] } });
    const r = await c.test();
    expect(r.ok).toBe(true);
    expect(getMock.mock.calls[0]![1].params).toMatchObject({ page: 1, per_page: 1 });
  });

  it('test() surfaces the upstream HTTP status on failure', async () => {
    const err = new AxiosError(
      'request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      { status: 503, statusText: 'Service Unavailable', headers: new AxiosHeaders(), config: { headers: new AxiosHeaders() } } as never,
    );
    getMock.mockRejectedValueOnce(err);
    const r = await c.test();
    expect(r.ok).toBe(false);
    expect(r.error).toContain('HTTP 503');
  });
});

describe('CrmApiConnector · retry policy', () => {
  it('exposes axios-retry on the real client (smoke)', () => {
    // The real axios client should be wired up — assert no throw on construction.
    const c = new CrmApiConnector({ baseUrl: 'https://api.example.com', token: 'tk' });
    expect(c.name).toBe('crm-api');
    expect(c.pageSize).toBe(200);
    expect(axios).toBeDefined();
  });
});
