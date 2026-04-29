// ERP Postgres connector — reads the read-only view `vw_painel_v27`
// exposed by the ERP. Mapping rules:
//   marca  → Brand  (KIKI / "MENINA ANJO" → MA / VALENT)
//   linha  → ProductLine
//   faixa  → PriceTier (with accent → MEDIO)
//   perfil → CustomerProfile

import { Pool, type PoolConfig } from 'pg';
import {
  BRAND_FROM_LABEL,
  CUSTOMER_PROFILE_FROM_LABEL,
  LINE_FROM_LABEL,
  PRICE_TIER_FROM_LABEL,
} from '@painel/shared';
import {
  ConnectorError,
  type ConnectorTestResult,
  type NormalizedSale,
  type SaleConnector,
} from './types';

export interface ErpRow {
  external_id: string;
  product_sku: string;
  product_name: string;
  brand: string; // 'KIKI' | 'MENINA ANJO' | 'VALENT'
  product_line: string;
  product_group: string;
  coord_season: string | null;
  price_tier: string; // 'ENTRADA' | 'MÉDIO' | 'PREMIUM'
  designer: string | null;
  unit_price: string | number | null; // numeric arrives as string from pg
  customer_id: string;
  customer_name: string;
  customer_profile: string;
  rep_full_name: string | null;
  city_name: string | null;
  uf_id: string;
  qty: number;
  value: string | number;
  cost: string | number | null;
  unit_cost: string | number | null;
  date: Date | string;
  source_updated_at: Date | string;
}

export interface ErpPostgresOptions {
  connectionString: string;
  name?: string;
  /** Override the source view name (default `vw_painel_v27`). */
  view?: string;
  poolConfig?: Omit<PoolConfig, 'connectionString'>;
}

const SQL_QUERY = (view: string) => `
  SELECT * FROM ${view}
  WHERE source_updated_at > $1
  ORDER BY source_updated_at ASC
`;

export class ErpPostgresConnector implements SaleConnector {
  readonly type = 'ERP_DB' as const;
  readonly name: string;
  readonly view: string;
  private pool: Pool;

  constructor(opts: ErpPostgresOptions) {
    this.name = opts.name ?? 'erp-postgres';
    this.view = opts.view ?? 'vw_painel_v27';
    this.pool = new Pool({
      connectionString: opts.connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      ...opts.poolConfig,
    });
  }

  async test(): Promise<ConnectorTestResult> {
    try {
      const r = await this.pool.query<{ ok: number; n: number }>(
        `SELECT 1 AS ok, COUNT(*)::int AS n FROM ${this.view} LIMIT 1`,
      );
      const n = r.rows[0]?.n ?? 0;
      return { ok: true, detail: `view ${this.view} reachable · ~${n} rows visible` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async extract(since: Date): Promise<NormalizedSale[]> {
    let rows: ErpRow[];
    try {
      const r = await this.pool.query<ErpRow>(SQL_QUERY(this.view), [since]);
      rows = r.rows;
    } catch (e) {
      throw new ConnectorError(this.name, 'extract', (e as Error).message, e);
    }
    return rows.map((row) => this.transform(row));
  }

  /** Public for unit testing. */
  transform(row: ErpRow): NormalizedSale {
    const brand = BRAND_FROM_LABEL[row.brand];
    if (!brand) throw new ConnectorError(this.name, 'transform', `unknown brand "${row.brand}"`);
    const line = LINE_FROM_LABEL[row.product_line];
    if (!line) throw new ConnectorError(this.name, 'transform', `unknown line "${row.product_line}"`);
    const tier = PRICE_TIER_FROM_LABEL[row.price_tier];
    if (!tier) throw new ConnectorError(this.name, 'transform', `unknown tier "${row.price_tier}"`);
    const profile = CUSTOMER_PROFILE_FROM_LABEL[row.customer_profile];
    if (!profile)
      throw new ConnectorError(
        this.name,
        'transform',
        `unknown customer profile "${row.customer_profile}"`,
      );

    return {
      externalId: row.external_id,
      productSku: row.product_sku,
      productName: row.product_name,
      brand,
      productLine: line,
      productGroup: row.product_group,
      coordSeason: row.coord_season ?? undefined,
      priceTier: tier,
      designer: row.designer ?? undefined,
      unitPrice: toNumber(row.unit_price) ?? undefined,
      customerId: String(row.customer_id),
      customerName: row.customer_name,
      customerProfile: profile,
      repFullName: row.rep_full_name ?? undefined,
      cityName: row.city_name?.trim() || undefined,
      ufId: row.uf_id,
      qty: row.qty,
      value: toNumber(row.value) ?? 0,
      cost: toNumber(row.cost) ?? undefined,
      unitCost: toNumber(row.unit_cost) ?? undefined,
      date: toDate(row.date),
      sourceUpdatedAt: toDate(row.source_updated_at),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

// SQL the ERP DBA needs to expose this view. Documented next to the
// connector so the contract lives in code.
export const ERP_VIEW_SQL = /* sql */ `
CREATE OR REPLACE VIEW vw_painel_v27 AS
SELECT
  s.id::text                                              AS external_id,
  p.sku                                                   AS product_sku,
  p.descricao                                             AS product_name,
  p.marca                                                 AS brand,
  p.linha                                                 AS product_line,
  p.grupo                                                 AS product_group,
  p.coordenado                                            AS coord_season,
  p.faixa                                                 AS price_tier,
  p.estilista                                             AS designer,
  p.preco_medio                                           AS unit_price,
  c.codigo                                                AS customer_id,
  c.razao_social                                          AS customer_name,
  c.perfil                                                AS customer_profile,
  r.razao_social                                          AS rep_full_name,
  c.cidade                                                AS city_name,
  c.uf                                                    AS uf_id,
  s.quantidade                                            AS qty,
  s.valor_total                                           AS value,
  s.custo_total                                           AS cost,
  s.custo_unitario                                        AS unit_cost,
  s.data_emissao                                          AS date,
  s.updated_at                                            AS source_updated_at
FROM vendas s
JOIN produtos p          ON p.id = s.produto_id
JOIN clientes c          ON c.id = s.cliente_id
LEFT JOIN representantes r ON r.id = c.representante_id
WHERE p.colecao = 'V27';
`.trim();
