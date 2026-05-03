// Fixture connectors — load painel_v27 JSONs and emit them as if they
// came from the real source. Activated when USE_MOCK_CONNECTORS=true.

import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import {
  BRAND_FROM_LABEL,
  CUSTOMER_PROFILE_FROM_LABEL,
  LINE_FROM_LABEL,
  PRICE_TIER_FROM_LABEL,
  type Brand,
} from '@painel/shared';
import {
  ConnectorError,
  type ConnectorTestResult,
  type ConnectorType,
  type NormalizedSale,
  type NormalizedTarget,
  type SaleConnector,
  type TargetConnector,
} from './types';

const SNAPSHOT_DATE = new Date('2026-04-28T00:00:00Z');

// ---------- Sale fixture ----------

interface FixtureRec {
  p: string; dp: string; m: string; l: string; g: string; co: string;
  uf: string; cid: string; c: number; nm: string; rp: string; pf: string;
  q: number; f: number; ct: number; cu: number; fx: string; est: string;
}

interface FixtureBundle {
  recs: FixtureRec[];
  pm_marca_v27: Record<string, number>;
}

export interface FixtureSaleOptions {
  /** ConnectorType this fixture is masquerading as (ERP_DB or CRM_API). */
  type: ConnectorType;
  /** Directory containing d_v12.json (default: <repo>/painel_v27). */
  fixturesDir: string;
  name?: string;
}

export class FixtureSaleConnector implements SaleConnector {
  readonly type: ConnectorType;
  readonly name: string;
  private fixturesDir: string;

  constructor(opts: FixtureSaleOptions) {
    this.type = opts.type;
    this.name = opts.name ?? `fixture-${opts.type.toLowerCase()}`;
    this.fixturesDir = opts.fixturesDir;
  }

  async test(): Promise<ConnectorTestResult> {
    const file = path.join(this.fixturesDir, 'd_v12.json');
    if (!existsSync(file)) return { ok: false, error: `fixture missing: ${file}` };
    return { ok: true, detail: `fixture mode · ${file}` };
  }

  async extract(since: Date): Promise<NormalizedSale[]> {
    const bundle = this.loadBundle();
    const cutoff = since instanceof Date ? since.getTime() : 0;
    if (cutoff >= SNAPSHOT_DATE.getTime()) return []; // already synced past the snapshot

    return bundle.recs.map((r, idx) => this.transform(r, idx, bundle.pm_marca_v27));
  }

  /** Public for unit testing. */
  transform(r: FixtureRec, idx: number, pmByBrand: Record<string, number>): NormalizedSale {
    const brand = BRAND_FROM_LABEL[r.m];
    const line = LINE_FROM_LABEL[r.l];
    const tier = PRICE_TIER_FROM_LABEL[r.fx];
    const profile = CUSTOMER_PROFILE_FROM_LABEL[r.pf];
    if (!brand || !line || !tier || !profile) {
      throw new ConnectorError(this.name, 'transform', `unknown enum on rec #${idx} (${r.p})`);
    }
    const pm = pmByBrand[r.m];
    return {
      externalId: `fixture-${idx}`,
      productSku: r.p,
      productName: r.dp,
      brand,
      productLine: line,
      productGroup: r.g,
      coordSeason: r.co || undefined,
      priceTier: tier,
      designer: r.est?.trim() || undefined,
      unitPrice: pm,
      customerId: String(r.c),
      customerName: r.nm,
      customerProfile: profile,
      repFullName: r.rp,
      cityName: r.cid?.trim() || undefined,
      ufId: r.uf,
      qty: r.q,
      value: r.f,
      cost: r.ct,
      unitCost: r.cu,
      date: SNAPSHOT_DATE,
      sourceUpdatedAt: SNAPSHOT_DATE,
      collection: 'V27',
    };
  }

  private loadBundle(): FixtureBundle {
    const file = path.join(this.fixturesDir, 'd_v12.json');
    const raw = readFileSync(file, 'utf-8');
    return JSON.parse(raw) as FixtureBundle;
  }
}

// ---------- Target fixture ----------

export interface FixtureTargetOptions {
  fixturesDir: string;
  name?: string;
}

export class FixtureTargetConnector implements TargetConnector {
  readonly type = 'XLSX' as const;
  readonly name: string;
  private fixturesDir: string;

  constructor(opts: FixtureTargetOptions) {
    this.name = opts.name ?? 'fixture-xlsx';
    this.fixturesDir = opts.fixturesDir;
  }

  async test(): Promise<ConnectorTestResult> {
    const file = path.join(this.fixturesDir, 'd_v12.json');
    if (!existsSync(file)) return { ok: false, error: `fixture missing: ${file}` };
    return { ok: true, detail: `fixture mode · synthetic targets from ${file}` };
  }

  async extract(): Promise<NormalizedTarget[]> {
    const file = path.join(this.fixturesDir, 'd_v12.json');
    const d = JSON.parse(readFileSync(file, 'utf-8')) as { recs: FixtureRec[] };
    const totalV27 = d.recs.reduce((s, r) => s + r.f, 0);
    const byBrand: Partial<Record<string, number>> = {};
    const byUf: Partial<Record<string, number>> = {};
    for (const r of d.recs) {
      byBrand[r.m] = (byBrand[r.m] ?? 0) + r.f;
      byUf[r.uf] = (byUf[r.uf] ?? 0) + r.f;
    }

    const targets: NormalizedTarget[] = [];

    targets.push({
      scope: 'GLOBAL',
      scopeKey: 'V27',
      period: 'V27',
      unit: 'BRL',
      valueTarget: Math.ceil(totalV27 / 500_000) * 500_000,
    });

    for (const [label, achieved] of Object.entries(byBrand)) {
      const brand: Brand | undefined = BRAND_FROM_LABEL[label];
      if (!brand) continue;
      targets.push({
        scope: 'BRAND',
        scopeKey: brand,
        brand,
        period: 'V27',
        unit: 'BRL',
        valueTarget: Math.ceil((achieved ?? 0) / 100_000) * 110_000, // +10 % stretch
      });
    }

    for (const [ufId, achieved] of Object.entries(byUf)) {
      targets.push({
        scope: 'UF',
        scopeKey: ufId,
        ufId,
        period: 'V27',
        unit: 'BRL',
        valueTarget: Math.ceil((achieved ?? 0) / 50_000) * 55_000,
      });
    }

    return targets;
  }
}
