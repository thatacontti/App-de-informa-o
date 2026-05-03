import { describe, expect, it, vi } from 'vitest';
import { Base44Connector, type Base44Mapper } from '../base44';
import type { NormalizedSale } from '../types';

const SAMPLE_SALE = (over: Partial<NormalizedSale> = {}): NormalizedSale => ({
  externalId: 'b44-1',
  productSku: 'SKU-1',
  productName: 'PRODUCT',
  brand: 'KIKI',
  productLine: 'INFANTIL',
  productGroup: 'VESTIDO',
  priceTier: 'MEDIO',
  customerId: 'C1',
  customerName: 'CLIENTE',
  ufId: 'SP',
  qty: 1,
  value: 100,
  date: new Date('2026-04-28'),
  sourceUpdatedAt: new Date('2026-04-28'),
  collection: 'V27',
  ...over,
});

/** Constrói um Base44Client falso com um único entity handler stub. */
function makeStubClient(
  entityName: string,
  handler: { list: ReturnType<typeof vi.fn>; filter?: ReturnType<typeof vi.fn> },
) {
  return {
    entities: { [entityName]: handler },
  } as unknown as ConstructorParameters<typeof Base44Connector>[0]['client'];
}

const passthroughMapper: Base44Mapper = (_rec, idx) => SAMPLE_SALE({ externalId: `b44-${idx}` });

describe('Base44Connector', () => {
  describe('test()', () => {
    it('reporta sucesso quando a entidade tem handler', async () => {
      const list = vi.fn().mockResolvedValue([{ id: '1' }]);
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: passthroughMapper,
        client: makeStubClient('Sale', { list }),
      });
      const r = await c.test();
      expect(r.ok).toBe(true);
      expect(r.detail).toContain('Sale');
    });

    it('reporta erro quando a chamada falha (ex: 403 do allowlist)', async () => {
      const list = vi.fn().mockRejectedValue(new Error('Host not in allowlist'));
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: passthroughMapper,
        client: makeStubClient('Sale', { list }),
      });
      const r = await c.test();
      expect(r.ok).toBe(false);
      expect(r.error).toContain('allowlist');
    });
  });

  describe('extract() · pagination', () => {
    it('pagina enquanto a página chega no pageSize', async () => {
      // 3 chamadas: 2 cheias + 1 parcial → para.
      const list = vi
        .fn()
        .mockResolvedValueOnce(Array(500).fill({ id: 'x' }))
        .mockResolvedValueOnce(Array(500).fill({ id: 'y' }))
        .mockResolvedValueOnce([{ id: 'z' }]);
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: passthroughMapper,
        client: makeStubClient('Sale', { list }),
      });
      const sales = await c.extract(new Date(0));
      expect(sales).toHaveLength(1001);
      expect(list).toHaveBeenCalledTimes(3);
      // skip cresce 0 → 500 → 1000
      expect(list.mock.calls[0]?.[2]).toBe(0);
      expect(list.mock.calls[1]?.[2]).toBe(500);
      expect(list.mock.calls[2]?.[2]).toBe(1000);
    });

    it('para imediatamente quando a primeira página vem vazia', async () => {
      const list = vi.fn().mockResolvedValue([]);
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: passthroughMapper,
        client: makeStubClient('Sale', { list }),
      });
      const sales = await c.extract(new Date(0));
      expect(sales).toHaveLength(0);
      expect(list).toHaveBeenCalledTimes(1);
    });
  });

  describe('extract() · incremental filter', () => {
    it('usa list() (sem filter) quando since=epoch 0', async () => {
      const list = vi.fn().mockResolvedValue([]);
      const filter = vi.fn();
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: passthroughMapper,
        client: makeStubClient('Sale', { list, filter }),
      });
      await c.extract(new Date(0));
      expect(list).toHaveBeenCalledTimes(1);
      expect(filter).not.toHaveBeenCalled();
    });

    it('usa filter({ updated_date: { $gt: since } }) quando há cutoff real', async () => {
      const list = vi.fn();
      const filter = vi.fn().mockResolvedValue([]);
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: passthroughMapper,
        client: makeStubClient('Sale', { list, filter }),
      });
      const since = new Date('2026-04-28T00:00:00Z');
      await c.extract(since);
      expect(filter).toHaveBeenCalledTimes(1);
      const [query, sort] = filter.mock.calls[0]!;
      expect(query).toEqual({ updated_date: { $gt: since.toISOString() } });
      expect(sort).toBe('+updated_date');
      expect(list).not.toHaveBeenCalled();
    });

    it('respeita incrementalField customizado', async () => {
      const filter = vi.fn().mockResolvedValue([]);
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: passthroughMapper,
        incrementalField: 'last_modified',
        client: makeStubClient('Sale', { list: vi.fn(), filter }),
      });
      await c.extract(new Date('2026-01-01'));
      const [query, sort] = filter.mock.calls[0]!;
      expect(Object.keys(query as object)).toEqual(['last_modified']);
      expect(sort).toBe('+last_modified');
    });
  });

  describe('extract() · errors', () => {
    it('embrulha erro do mapper apontando o índice da linha', async () => {
      const list = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      const failingMapper: Base44Mapper = (_rec, idx) => {
        if (idx === 1) throw new Error('campo brand vazio');
        return SAMPLE_SALE({ externalId: `b44-${idx}` });
      };
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'Sale',
        mapper: failingMapper,
        client: makeStubClient('Sale', { list }),
      });
      await expect(c.extract(new Date(0))).rejects.toThrow(/linha 2/);
    });

    it('joga ConnectorError quando entidade não existe no SDK', async () => {
      const c = new Base44Connector({
        appId: 'app',
        apiKey: 'key',
        entityName: 'EntidadeFantasma',
        mapper: passthroughMapper,
        client: { entities: {} } as unknown as ConstructorParameters<
          typeof Base44Connector
        >[0]['client'],
      });
      await expect(c.extract(new Date(0))).rejects.toThrow(/EntidadeFantasma/);
    });
  });
});
