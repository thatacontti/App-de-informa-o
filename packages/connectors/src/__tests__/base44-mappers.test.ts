import { describe, expect, it } from 'vitest';
import {
  makeSaleMapper,
  makeSalesDataMapper,
  type Base44SaleRecord,
  type Base44SalesDataRecord,
} from '../base44-mappers';

const SD = (over: Partial<Base44SalesDataRecord> = {}): Base44SalesDataRecord => ({
  p: 'M4300004',
  dp: 'MACAQUINHO',
  m: 'MENINA ANJO',
  l: 'TEEN',
  g: 'MACAQUINHO',
  co: 'RESORT 2027',
  uf: 'PR',
  cid: 'TOLEDO',
  c: '99001',
  nm: 'CLIENTE TESTE LTDA',
  rp: 'L N BANDEIRA LTDA',
  pf: 'REGULAR',
  q: 7,
  f: 626.4,
  ct: 257.1,
  cu: 36.7485,
  fx: 'MÉDIO',
  est: 'BRUNA',
  id: 'b44-id-1',
  created_date: '2026-04-28T00:00:00Z',
  updated_date: '2026-04-28T12:00:00Z',
  ...over,
});

const SALE = (over: Partial<Base44SaleRecord> = {}): Base44SaleRecord => ({
  ...SD(),
  collectionCode: 'V27',
  externalId: 'erp-1',
  source: 'ERP_API_LIVE',
  ...over,
});

describe('makeSalesDataMapper', () => {
  it('mapeia campos required corretamente, default collection V27', () => {
    const map = makeSalesDataMapper();
    const s = map(SD() as unknown as Record<string, unknown>, 0);
    expect(s.brand).toBe('MA');
    expect(s.productLine).toBe('TEEN');
    expect(s.priceTier).toBe('MEDIO');
    expect(s.customerProfile).toBe('REGULAR');
    expect(s.customerId).toBe('99001');
    expect(s.cityName).toBe('TOLEDO');
    expect(s.ufId).toBe('PR');
    expect(s.qty).toBe(7);
    expect(s.value).toBe(626.4);
    expect(s.unitPrice).toBeCloseTo(89.485);
    expect(s.collection).toBe('V27');
    expect(s.externalId).toBe('b44-sd-b44-id-1');
    expect(s.date.toISOString()).toBe('2026-04-28T12:00:00.000Z');
  });

  it('aceita defaultCollection custom', () => {
    const map = makeSalesDataMapper({ defaultCollection: 'VERAO_2027_VERAO' });
    const s = map(SD() as unknown as Record<string, unknown>, 0);
    expect(s.collection).toBe('VERAO_2027_VERAO');
  });

  it('deriva priceTier de f/q quando fx ausente', () => {
    const map = makeSalesDataMapper();
    // q=1, f=40 → unit 40 → ENTRADA
    const a = map(SD({ fx: undefined, q: 1, f: 40 }) as unknown as Record<string, unknown>, 0);
    expect(a.priceTier).toBe('ENTRADA');
    // q=1, f=120 → unit 120 → PREMIUM
    const b = map(SD({ fx: '', q: 1, f: 120 }) as unknown as Record<string, unknown>, 1);
    expect(b.priceTier).toBe('PREMIUM');
  });

  it('gera externalId determinístico quando id ausente', () => {
    const map = makeSalesDataMapper();
    const s = map(SD({ id: undefined }) as unknown as Record<string, unknown>, 0);
    // sem id real → conteúdo: SKU-customerId-qty-value
    expect(s.externalId).toBe('b44-sd-M4300004-99001-7-626.40');
  });

  it('joga erro em marca desconhecida', () => {
    const map = makeSalesDataMapper();
    expect(() => map(SD({ m: 'FOOBAR' }) as unknown as Record<string, unknown>, 5)).toThrow(
      /marca desconhecida.*FOOBAR.*linha 6/,
    );
  });

  it('joga erro em SKU vazio', () => {
    const map = makeSalesDataMapper();
    expect(() => map(SD({ p: '' }) as unknown as Record<string, unknown>, 0)).toThrow(/SKU vazio/);
  });

  it('customerProfile vira undefined quando label não está no enum', () => {
    const map = makeSalesDataMapper();
    const s = map(SD({ pf: 'PROFILE_INEXISTENTE' }) as unknown as Record<string, unknown>, 0);
    expect(s.customerProfile).toBeUndefined();
  });

  it('cost null quando ct ausente, derive unitCost de ct/q quando cu ausente', () => {
    const map = makeSalesDataMapper();
    const a = map(SD({ ct: undefined, cu: undefined }) as unknown as Record<string, unknown>, 0);
    expect(a.cost).toBeUndefined();
    expect(a.unitCost).toBeUndefined();
    // ct=70, q=7, cu ausente → unitCost = 10
    const b = map(SD({ ct: 70, cu: undefined, q: 7 }) as unknown as Record<string, unknown>, 0);
    expect(b.cost).toBe(70);
    expect(b.unitCost).toBe(10);
  });
});

describe('makeSaleMapper', () => {
  it('usa collectionCode do registro (não o default V27)', () => {
    const map = makeSaleMapper();
    const s = map(SALE({ collectionCode: 'INVERNO_2026' }) as unknown as Record<string, unknown>, 0);
    expect(s.collection).toBe('INVERNO_2026');
  });

  it('joga erro quando collectionCode vazio', () => {
    const map = makeSaleMapper();
    expect(() =>
      map(SALE({ collectionCode: '' }) as unknown as Record<string, unknown>, 3),
    ).toThrow(/sem collectionCode.*linha 4/);
  });

  it('externalId compõe source + externalId pra evitar colisão entre fontes', () => {
    const map = makeSaleMapper();
    const s = map(
      SALE({ source: 'ERP_API_LIVE', externalId: 'erp-42' }) as unknown as Record<string, unknown>,
      0,
    );
    expect(s.externalId).toBe('b44-erp-api-live-erp-42');
  });

  it('cai pra id quando externalId não vem do Base44', () => {
    const map = makeSaleMapper();
    const s = map(
      SALE({ externalId: undefined, id: 'b44-id-99', source: 'HISTORICAL_DUMP' }) as unknown as Record<
        string,
        unknown
      >,
      0,
    );
    expect(s.externalId).toBe('b44-historical-dump-b44-id-99');
  });

  it('usa updated_date como sourceUpdatedAt', () => {
    const map = makeSaleMapper();
    const s = map(
      SALE({
        created_date: '2025-01-01T00:00:00Z',
        updated_date: '2026-05-01T00:00:00Z',
      }) as unknown as Record<string, unknown>,
      0,
    );
    expect(s.sourceUpdatedAt.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });
});
