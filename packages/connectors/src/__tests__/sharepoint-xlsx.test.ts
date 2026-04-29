import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { SharePointXlsxConnector } from '../sharepoint-xlsx';

function buildWorkbook(opts?: {
  global?: Array<Record<string, unknown>>;
  brand?: Array<Record<string, unknown>>;
  uf?: Array<Record<string, unknown>>;
  extra?: Record<string, Array<Record<string, unknown>>>;
}): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Array<Record<string, unknown>>) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  };
  add('Metas_Globais', opts?.global ?? [
    { period: 'V27', unit: 'BRL', scope_key: 'V27', value_target: 5_000_000 },
  ]);
  add('Metas_Marca', opts?.brand ?? [
    { period: 'V27', unit: 'BRL', brand: 'KIKI', value_target: 3_000_000 },
    { period: 'V27', unit: 'BRL', brand: 'MENINA ANJO', value_target: 800_000 },
    { period: 'V27', unit: 'BRL', brand: 'VALENT', value_target: 600_000 },
  ]);
  add('Metas_UF', opts?.uf ?? [
    { period: 'V27', unit: 'BRL', uf: 'SP', value_target: 1_500_000 },
    { period: 'V27', unit: 'BRL', uf: 'PR', value_target: 800_000 },
  ]);
  if (opts?.extra) for (const [name, rows] of Object.entries(opts.extra)) add(name, rows);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

function makeConnector(buf: ArrayBuffer) {
  return new SharePointXlsxConnector({
    tenantId: 't',
    clientId: 'c',
    clientSecret: 's',
    sitePath: 'host:/sites/diretoria',
    filePath: '/Diretoria/Metas/V27.xlsx',
    fetchToken: async () => 'fake-token',
    fetchFile: async () => buf,
  });
}

describe('SharePointXlsxConnector', () => {
  it('test() reports OK when the 3 required sheets exist', async () => {
    const c = makeConnector(buildWorkbook());
    const r = await c.test();
    expect(r.ok).toBe(true);
    expect(r.detail).toMatch(/Metas_Globais.*Metas_Marca.*Metas_UF/);
  });

  it('test() reports failure when a required sheet is missing', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ a: 1 }]), 'Outras');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const c = makeConnector(buf);
    const r = await c.test();
    expect(r.ok).toBe(false);
    expect(r.error).toContain('missing sheets');
    expect(r.error).toContain('Metas_Globais');
  });

  it('extract() returns 1 GLOBAL + 3 BRAND + 2 UF normalised targets', async () => {
    const c = makeConnector(buildWorkbook());
    const targets = await c.extract();
    expect(targets).toHaveLength(6);

    const global = targets.find((t) => t.scope === 'GLOBAL');
    expect(global?.valueTarget).toBe(5_000_000);

    const kiki = targets.find((t) => t.scope === 'BRAND' && t.brand === 'KIKI');
    expect(kiki?.valueTarget).toBe(3_000_000);

    const ma = targets.find((t) => t.scope === 'BRAND' && t.brand === 'MA');
    expect(ma?.valueTarget).toBe(800_000);

    const sp = targets.find((t) => t.scope === 'UF' && t.ufId === 'SP');
    expect(sp?.valueTarget).toBe(1_500_000);
  });

  it('extract() rejects an unknown brand label', async () => {
    const buf = buildWorkbook({
      brand: [{ period: 'V27', unit: 'BRL', brand: 'NOVA MARCA', value_target: 1 }],
    });
    const c = makeConnector(buf);
    await expect(c.extract()).rejects.toThrow(/unknown brand label/);
  });

  it('extract() rejects an invalid UF code', async () => {
    const buf = buildWorkbook({
      uf: [{ period: 'V27', unit: 'BRL', uf: 'sao paulo', value_target: 1 }],
    });
    const c = makeConnector(buf);
    await expect(c.extract()).rejects.toThrow(/invalid UF/);
  });

  it('parses BR-formatted numbers (R$ 1.500.000,00 → 1500000)', async () => {
    const buf = buildWorkbook({
      uf: [{ period: 'V27', unit: 'BRL', uf: 'SP', value_target: 'R$ 1.500.000,00' }],
    });
    const c = makeConnector(buf);
    const targets = await c.extract();
    const sp = targets.find((t) => t.ufId === 'SP');
    expect(sp?.valueTarget).toBe(1_500_000);
  });

  it('defaults unit to BRL when the column is missing', async () => {
    const buf = buildWorkbook({
      global: [{ period: 'V27', value_target: 1 }],
    });
    const c = makeConnector(buf);
    const targets = await c.extract();
    expect(targets.find((t) => t.scope === 'GLOBAL')?.unit).toBe('BRL');
  });
});
