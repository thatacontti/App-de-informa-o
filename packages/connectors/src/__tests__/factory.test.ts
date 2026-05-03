import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import {
  createSaleConnector,
  createTargetConnector,
  defaultFixturesDir,
  registerBase44Mapper,
} from '../factory';
import { Base44Connector } from '../base44';
import { CrmApiConnector } from '../crm-api';
import { CsvHistoricoConnector } from '../csv-historico';
import { ErpPostgresConnector } from '../erp-postgres';
import { FixtureSaleConnector, FixtureTargetConnector } from '../fixture';
import { SharePointXlsxConnector } from '../sharepoint-xlsx';
import type { NormalizedSale } from '../types';

const FIXTURES_DIR = path.resolve(__dirname, '../../../..', 'painel_v27');

// Registra um mapper de teste no registry global. Não polui outros
// testes porque o nome é único.
const NOOP_MAPPER = (_rec: Record<string, unknown>, idx: number): NormalizedSale => ({
  externalId: `t-${idx}`,
  productSku: 'SKU',
  productName: 'P',
  brand: 'KIKI',
  productLine: 'INFANTIL',
  productGroup: 'X',
  priceTier: 'MEDIO',
  customerId: 'C',
  customerName: 'C',
  ufId: 'SP',
  qty: 1,
  value: 1,
  date: new Date(0),
  sourceUpdatedAt: new Date(0),
  collection: 'V27',
});
registerBase44Mapper('test-mapper', NOOP_MAPPER);

describe('factory · mock mode', () => {
  it('returns FixtureSaleConnector for ERP_DB', () => {
    const c = createSaleConnector(
      { type: 'ERP_DB', name: 'erp', endpoint: 'irrelevant' },
      { useMock: true, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(FixtureSaleConnector);
    expect(c.type).toBe('ERP_DB');
  });

  it('returns FixtureSaleConnector for CRM_API', () => {
    const c = createSaleConnector(
      { type: 'CRM_API', name: 'crm', endpoint: 'irrelevant' },
      { useMock: true, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(FixtureSaleConnector);
    expect(c.type).toBe('CRM_API');
  });

  it('returns FixtureTargetConnector for XLSX', () => {
    const c = createTargetConnector(
      { type: 'XLSX', name: 'xlsx', endpoint: '/Diretoria/Metas/V27.xlsx' },
      { useMock: true, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(FixtureTargetConnector);
  });
});

describe('factory · real mode', () => {
  it('builds an ErpPostgresConnector', () => {
    const c = createSaleConnector(
      { type: 'ERP_DB', name: 'erp', endpoint: 'postgres://x:y@h/db' },
      { useMock: false, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(ErpPostgresConnector);
  });

  it('builds a CrmApiConnector when token is supplied', () => {
    const c = createSaleConnector(
      { type: 'CRM_API', name: 'crm', endpoint: 'https://api.x', config: { token: 'tk' } },
      { useMock: false, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(CrmApiConnector);
  });

  it('rejects CRM_API without a token', () => {
    expect(() =>
      createSaleConnector(
        { type: 'CRM_API', name: 'crm', endpoint: 'https://api.x' },
        { useMock: false, fixturesDir: FIXTURES_DIR },
      ),
    ).toThrow(/requires config\.token/);
  });

  it('builds a SharePointXlsxConnector when all SharePoint params are present', () => {
    const c = createTargetConnector(
      {
        type: 'XLSX',
        name: 'xlsx',
        endpoint: '/Diretoria/Metas/V27.xlsx',
        config: { tenantId: 't', clientId: 'c', clientSecret: 's', sitePath: 'host:/sites/d' },
      },
      { useMock: false, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(SharePointXlsxConnector);
  });

  it('rejects XLSX without SharePoint config', () => {
    expect(() =>
      createTargetConnector(
        { type: 'XLSX', name: 'xlsx', endpoint: '/x.xlsx' },
        { useMock: false, fixturesDir: FIXTURES_DIR },
      ),
    ).toThrow(/requires config/);
  });

  it('builds a CsvHistoricoConnector pointing at the configured file', () => {
    const c = createSaleConnector(
      { type: 'CSV_HISTORICO', name: 'historico-v01', endpoint: '/app/Pasta1_v01.csv' },
      { useMock: false, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(CsvHistoricoConnector);
    expect(c.type).toBe('CSV_HISTORICO');
  });

  it('CSV_HISTORICO ignores useMock — there is no live source to mock', () => {
    const c = createSaleConnector(
      { type: 'CSV_HISTORICO', name: 'historico-v01', endpoint: '/app/Pasta1_v01.csv' },
      { useMock: true, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(CsvHistoricoConnector);
  });

  it('builds a Base44Connector when apiKey/entityName/mapperName are present', () => {
    const c = createSaleConnector(
      {
        type: 'BASE44_API',
        name: 'base44-sales',
        endpoint: 'app-id-xyz',
        config: { apiKey: 'k', entityName: 'Sale', mapperName: 'test-mapper' },
      },
      { useMock: false, fixturesDir: FIXTURES_DIR },
    );
    expect(c).toBeInstanceOf(Base44Connector);
    expect(c.type).toBe('BASE44_API');
  });

  it('rejects BASE44_API without apiKey', () => {
    expect(() =>
      createSaleConnector(
        {
          type: 'BASE44_API',
          name: 'base44-sales',
          endpoint: 'app-id-xyz',
          config: { entityName: 'Sale', mapperName: 'test-mapper' },
        },
        { useMock: false, fixturesDir: FIXTURES_DIR },
      ),
    ).toThrow(/requires config\.apiKey/);
  });

  it('rejects BASE44_API when mapperName is unknown to the registry', () => {
    expect(() =>
      createSaleConnector(
        {
          type: 'BASE44_API',
          name: 'base44-sales',
          endpoint: 'app-id-xyz',
          config: { apiKey: 'k', entityName: 'Sale', mapperName: 'never-registered' },
        },
        { useMock: false, fixturesDir: FIXTURES_DIR },
      ),
    ).toThrow(/never-registered.*não registrado/);
  });
});

describe('factory · cross-type guards', () => {
  it('createSaleConnector refuses XLSX', () => {
    expect(() =>
      createSaleConnector(
        { type: 'XLSX' as const, name: 'x', endpoint: '/' },
        { useMock: true, fixturesDir: FIXTURES_DIR },
      ),
    ).toThrow(/does not handle XLSX/);
  });

  it('createTargetConnector refuses ERP_DB', () => {
    expect(() =>
      createTargetConnector(
        { type: 'ERP_DB' as const, name: 'erp', endpoint: '/' },
        { useMock: true, fixturesDir: FIXTURES_DIR },
      ),
    ).toThrow(/only handles XLSX/);
  });
});

describe('defaultFixturesDir', () => {
  it('returns an absolute path ending with painel_v27', () => {
    const dir = defaultFixturesDir();
    expect(path.isAbsolute(dir)).toBe(true);
    expect(dir).toMatch(/painel_v27$/);
  });
});
