// SharePoint XLSX connector — Microsoft Graph (Client Credentials Flow)
// downloads /Diretoria/Metas/V27.xlsx and parses three sheets:
//   Metas_Globais   one row · global target
//   Metas_Marca     one row per brand
//   Metas_UF        one row per UF
//
// All sheets share the columns:
//   period | unit (BRL|UNITS) | scope_key | value_target

import * as XLSX from 'xlsx';
import { BRAND_FROM_LABEL, type Brand } from '@painel/shared';
import {
  ConnectorError,
  type ConnectorTestResult,
  type NormalizedTarget,
  type TargetConnector,
} from './types';

export interface SharePointXlsxOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** SharePoint site path or hostname, e.g. catarina.sharepoint.com:/sites/diretoria */
  sitePath: string;
  /** File path relative to the site drive root, e.g. /Diretoria/Metas/V27.xlsx */
  filePath: string;
  name?: string;
  /** Inject token + buffer fetchers for tests. */
  fetchToken?: () => Promise<string>;
  fetchFile?: (token: string) => Promise<ArrayBuffer>;
}

export class SharePointXlsxConnector implements TargetConnector {
  readonly type = 'XLSX' as const;
  readonly name: string;
  private opts: SharePointXlsxOptions;

  constructor(opts: SharePointXlsxOptions) {
    this.name = opts.name ?? 'sharepoint-xlsx';
    this.opts = opts;
  }

  async test(): Promise<ConnectorTestResult> {
    try {
      const token = await this.fetchToken();
      const buf = await this.fetchFile(token);
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheets = wb.SheetNames;
      const required = ['Metas_Globais', 'Metas_Marca', 'Metas_UF'];
      const missing = required.filter((s) => !sheets.includes(s));
      if (missing.length) {
        return { ok: false, error: `missing sheets: ${missing.join(', ')}` };
      }
      return { ok: true, detail: `file OK · sheets ${sheets.join(', ')}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async extract(): Promise<NormalizedTarget[]> {
    let buf: ArrayBuffer;
    try {
      const token = await this.fetchToken();
      buf = await this.fetchFile(token);
    } catch (e) {
      throw new ConnectorError(this.name, 'extract', (e as Error).message, e);
    }

    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buf, { type: 'buffer' });
    } catch (e) {
      throw new ConnectorError(this.name, 'extract', `xlsx parse failed: ${(e as Error).message}`, e);
    }

    return [
      ...this.parseGlobalSheet(wb),
      ...this.parseBrandSheet(wb),
      ...this.parseUfSheet(wb),
    ];
  }

  // ----- sheet parsers (public for tests) -----

  parseGlobalSheet(wb: XLSX.WorkBook): NormalizedTarget[] {
    const rows = sheetRows(wb, 'Metas_Globais');
    return rows.map((r) => ({
      scope: 'GLOBAL' as const,
      scopeKey: pickStr(r, 'scope_key') ?? pickStr(r, 'period') ?? 'V27',
      period: pickStr(r, 'period') ?? 'V27',
      unit: pickUnit(r),
      valueTarget: pickNum(r, 'value_target', 'meta', 'target') ?? 0,
    }));
  }

  parseBrandSheet(wb: XLSX.WorkBook): NormalizedTarget[] {
    const rows = sheetRows(wb, 'Metas_Marca');
    return rows.map((r) => {
      const brandLabel = pickStr(r, 'brand', 'marca');
      const brand: Brand | undefined = brandLabel ? BRAND_FROM_LABEL[brandLabel] : undefined;
      if (!brand) {
        throw new ConnectorError(
          this.name,
          'transform',
          `Metas_Marca: unknown brand label "${brandLabel}"`,
        );
      }
      return {
        scope: 'BRAND' as const,
        scopeKey: brand,
        brand,
        period: pickStr(r, 'period') ?? 'V27',
        unit: pickUnit(r),
        valueTarget: pickNum(r, 'value_target', 'meta', 'target') ?? 0,
      };
    });
  }

  parseUfSheet(wb: XLSX.WorkBook): NormalizedTarget[] {
    const rows = sheetRows(wb, 'Metas_UF');
    return rows.map((r) => {
      const ufId = (pickStr(r, 'uf', 'uf_id') ?? '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(ufId)) {
        throw new ConnectorError(this.name, 'transform', `Metas_UF: invalid UF "${ufId}"`);
      }
      return {
        scope: 'UF' as const,
        scopeKey: ufId,
        ufId,
        period: pickStr(r, 'period') ?? 'V27',
        unit: pickUnit(r),
        valueTarget: pickNum(r, 'value_target', 'meta', 'target') ?? 0,
      };
    });
  }

  private async fetchToken(): Promise<string> {
    if (this.opts.fetchToken) return this.opts.fetchToken();
    const url = `https://login.microsoftonline.com/${this.opts.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.opts.clientId,
      client_secret: this.opts.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`token fetch failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('token fetch: no access_token in response');
    return json.access_token;
  }

  private async fetchFile(token: string): Promise<ArrayBuffer> {
    if (this.opts.fetchFile) return this.opts.fetchFile(token);
    const site = this.opts.sitePath;
    const file = this.opts.filePath.startsWith('/') ? this.opts.filePath : `/${this.opts.filePath}`;
    const url = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(site)}/drive/root:${file}:/content`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`file fetch failed: ${res.status} ${text}`);
    }
    return res.arrayBuffer();
  }
}

// -------- helpers --------

type Row = Record<string, unknown>;

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
}

function lower(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, '_');
}

function pickStr(row: Row, ...keys: string[]): string | undefined {
  for (const wanted of keys) {
    for (const [k, v] of Object.entries(row)) {
      if (lower(k) === wanted && v !== null && v !== undefined && v !== '') {
        return String(v).trim();
      }
    }
  }
  return undefined;
}

function pickNum(row: Row, ...keys: string[]): number | undefined {
  const s = pickStr(row, ...keys);
  if (!s) return undefined;
  const cleaned = s.replace(/[^\d.,\-]/g, '');
  // BR format: "1.500.000,00" → comma is decimal, dots are thousand separators.
  // EN format: "1500000.00"   → dot is decimal.
  const normalised = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : undefined;
}

function pickUnit(row: Row): 'BRL' | 'UNITS' {
  const u = pickStr(row, 'unit', 'unidade')?.toUpperCase();
  return u === 'UNITS' || u === 'UNIDADES' || u === 'PECAS' || u === 'PEÇAS'
    ? 'UNITS'
    : 'BRL';
}
