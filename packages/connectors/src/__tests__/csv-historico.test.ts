import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CsvHistoricoConnector,
  normalizeCollection,
  parseDecimalPt,
  parseDatePt,
  parseIntPt,
} from '../csv-historico';

const HEADER =
  'NUMERO;DT_EMISSAO;CODCLI;NOME;NOME_CID;COD_EST;GRUPO_CLI;DESC_GRUPO_CLI;CODREP;NOME_REP;PROD;DESC_PROD;DESCRICAO2;DESC_MARCA;DESC_LINHA;DESC_COLECAO;DESC_ETIQUETA;DESC_COORDENADO;CUSTO_IND;QTDE;VALOR_LIQ';

function writeCsv(rows: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'csv-historico-'));
  const file = join(dir, 'sample.csv');
  // Latin-1 encoding to match the real ERP output.
  const content = [HEADER, ...rows].join('\r\n');
  writeFileSync(file, content, 'latin1');
  return file;
}

describe('normalizeCollection', () => {
  it('strips accents, asterisks and spaces', () => {
    expect(normalizeCollection('VERAO 2020')).toBe('VERAO_2020');
    expect(normalizeCollection('*VERÃO 2021')).toBe('VERAO_2021');
    expect(normalizeCollection('INVERNO 2026')).toBe('INVERNO_2026');
    expect(normalizeCollection('VERAO 2023 - PRIMAVERA')).toBe('VERAO_2023_PRIMAVERA');
    expect(normalizeCollection('VERÃO 2025 - VERÃO ')).toBe('VERAO_2025_VERAO');
    expect(normalizeCollection('VERÃO 2022  PRIMAVERA')).toBe('VERAO_2022_PRIMAVERA');
    expect(normalizeCollection('TROPICAL 2025')).toBe('TROPICAL_2025');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeCollection('')).toBe('');
    expect(normalizeCollection('   ')).toBe('');
  });
});

describe('parseDecimalPt', () => {
  it('parses Brazilian decimals', () => {
    expect(parseDecimalPt('26,3')).toBe(26.3);
    expect(parseDecimalPt('1.234,56')).toBe(1234.56);
    expect(parseDecimalPt('0')).toBe(0);
  });

  it('returns null for invalid input', () => {
    expect(parseDecimalPt('')).toBeNull();
    expect(parseDecimalPt(undefined)).toBeNull();
    expect(parseDecimalPt('abc')).toBeNull();
  });
});

describe('parseIntPt', () => {
  it('parses integers', () => {
    expect(parseIntPt('4')).toBe(4);
    expect(parseIntPt('1.000')).toBe(1000);
  });
});

describe('parseDatePt', () => {
  it('parses DD/MM/YYYY', () => {
    const d = parseDatePt('02/10/2019');
    expect(d?.toISOString()).toBe('2019-10-02T00:00:00.000Z');
  });

  it('returns null for invalid date', () => {
    expect(parseDatePt('')).toBeNull();
    expect(parseDatePt('not-a-date')).toBeNull();
  });
});

describe('CsvHistoricoConnector', () => {
  it('test() reports the file size', async () => {
    const file = writeCsv(['']);
    try {
      const c = new CsvHistoricoConnector({ filePath: file });
      const r = await c.test();
      expect(r.ok).toBe(true);
      expect(r.detail).toContain('MB');
    } finally {
      rmSync(file, { force: true });
    }
  });

  it('test() fails for missing file', async () => {
    const c = new CsvHistoricoConnector({ filePath: '/no/such/path.csv' });
    const r = await c.test();
    expect(r.ok).toBe(false);
    expect(r.error).toContain('arquivo não encontrado');
  });

  it('extracts a normalised sale from a real-shaped row', async () => {
    const row =
      '22719;02/10/2019;08836;CLAUDIA PINHO LOPES;VOTORANTIM;SP;0009;CLIENTE;0025;PS DA SILVA GOMES REPRESENTACOES;85011;BLUSA INF. FEM.;SUEDINE;KIKI;INFANTIL;VERAO 2020;;;9,6158;1;26,3';
    const file = writeCsv([row]);
    try {
      const c = new CsvHistoricoConnector({ filePath: file });
      const sales = await c.extract(new Date(0));
      expect(sales).toHaveLength(1);

      const s = sales[0]!;
      expect(s.brand).toBe('KIKI');
      expect(s.productLine).toBe('INFANTIL');
      expect(s.collection).toBe('VERAO_2020');
      expect(s.productSku).toBe('85011');
      expect(s.customerId).toBe('08836');
      expect(s.customerName).toBe('CLAUDIA PINHO LOPES');
      expect(s.cityName).toBe('VOTORANTIM');
      expect(s.ufId).toBe('SP');
      expect(s.qty).toBe(1);
      expect(s.value).toBe(26.3);
      expect(s.unitPrice).toBe(26.3);
      // 26.30 < 50 → ENTRADA
      expect(s.priceTier).toBe('ENTRADA');
      expect(s.repFullName).toBe('PS DA SILVA GOMES REPRESENTACOES');
      expect(s.date.toISOString()).toBe('2019-10-02T00:00:00.000Z');
      expect(s.customerProfile).toBeUndefined();
      // ID determinístico — a mesma linha produz o mesmo externalId.
      expect(s.externalId).toBe('csv-22719-85011-08836-1-26.30');
    } finally {
      rmSync(file, { force: true });
    }
  });

  it('classifies price tiers using the configured thresholds', async () => {
    const rows = [
      // qty=1, value=40 → unitPrice 40 → ENTRADA
      '1;01/01/2024;C1;X;CIDADE;SP;0;CL;0;REP;P1;PROD;;KIKI;INFANTIL;INVERNO 2024;;;5;1;40,00',
      // qty=1, value=70 → MEDIO
      '2;01/01/2024;C1;X;CIDADE;SP;0;CL;0;REP;P2;PROD;;KIKI;INFANTIL;INVERNO 2024;;;5;1;70,00',
      // qty=1, value=120 → PREMIUM
      '3;01/01/2024;C1;X;CIDADE;SP;0;CL;0;REP;P3;PROD;;KIKI;INFANTIL;INVERNO 2024;;;5;1;120,00',
    ];
    const file = writeCsv(rows);
    try {
      const c = new CsvHistoricoConnector({ filePath: file });
      const sales = await c.extract(new Date(0));
      expect(sales.map((s) => s.priceTier)).toEqual(['ENTRADA', 'MEDIO', 'PREMIUM']);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it('throws on unknown brand', async () => {
    const row =
      '1;01/01/2024;C1;X;CIDADE;SP;0;CL;0;REP;P1;PROD;;FOOBRAND;INFANTIL;INVERNO 2024;;;5;1;40,00';
    const file = writeCsv([row]);
    try {
      const c = new CsvHistoricoConnector({ filePath: file });
      await expect(c.extract(new Date(0))).rejects.toThrow(/marca desconhecida/);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it('decodes Latin-1 collection labels with accents', async () => {
    const row =
      '1;01/01/2021;C1;X;CIDADE;SP;0;CL;0;REP;P1;PROD;;KIKI;INFANTIL;*VERÃO 2021;;;5;1;40,00';
    const file = writeCsv([row]);
    try {
      const c = new CsvHistoricoConnector({ filePath: file });
      const sales = await c.extract(new Date(0));
      expect(sales[0]?.collection).toBe('VERAO_2021');
    } finally {
      rmSync(file, { force: true });
    }
  });
});
