// Mappers Base44 → NormalizedSale.
//
// Documentado em https://catarina-vibe-flow.base44.app/api (schema do
// app `69f3d2ea55300f3afb7e35dc`). Duas entidades carregam vendas:
//
//   - `Sale` — formato richer com collectionCode, externalId, source.
//     Preferida quando o app já está no modelo definitivo.
//   - `SalesData` — formato flat (espelho do FixtureRec do painel_v27),
//     sem collection. Usada como fallback ou pra dados legados.
//
// Ambos os mappers seguem o mesmo padrão dos outros connectors:
//   - lookups via *_FROM_LABEL pra brand/line/profile
//   - priceTier deriva de f/q quando o campo `fx` está vazio
//   - fields opcionais viram undefined em vez de quebrar
//   - campos required-from-the-schema (m, q, f, p) jogam erro

import {
  BRAND_FROM_LABEL,
  CUSTOMER_PROFILE_FROM_LABEL,
  LINE_FROM_LABEL,
  PRICE_TIER_FROM_LABEL,
  type Brand,
  type PriceTier,
  type ProductLine,
} from '@painel/shared';
import { ConnectorError, type NormalizedSale } from './types';
import { DEFAULT_PRICE_THRESHOLDS, type PriceTierThresholds } from './csv-historico';

// Schema documentado das duas entidades (subset usado pelo mapper).
export interface Base44SalesDataRecord {
  p: string;
  dp?: string;
  m: string;
  l?: string;
  g?: string;
  co?: string;
  uf?: string;
  cid?: string;
  c?: string;
  nm?: string;
  rp?: string;
  pf?: string;
  q: number;
  f: number;
  ct?: number;
  cu?: number;
  fx?: string;
  est?: string;
  id?: string;
  created_date?: string;
  updated_date?: string;
}

export interface Base44SaleRecord extends Base44SalesDataRecord {
  collectionCode: string;
  externalId?: string;
  source?: string;
  frozen?: boolean;
  importBatchId?: string;
}

const NAME = '__base44_mapper__';

function priceTierFromValue(unitPrice: number, t: PriceTierThresholds): PriceTier {
  if (unitPrice < t.entrada) return 'ENTRADA';
  if (unitPrice >= t.premium) return 'PREMIUM';
  return 'MEDIO';
}

function requireBrand(raw: unknown, idx: number): Brand {
  const label = String(raw ?? '').trim();
  const b = BRAND_FROM_LABEL[label];
  if (!b) {
    throw new ConnectorError(NAME, 'transform', `marca desconhecida "${label}" (linha ${idx + 1})`);
  }
  return b;
}

function requireLine(raw: unknown, idx: number): ProductLine {
  const label = String(raw ?? '').trim();
  const l = LINE_FROM_LABEL[label];
  if (!l) {
    throw new ConnectorError(
      NAME,
      'transform',
      `linha de produto desconhecida "${label}" (linha ${idx + 1})`,
    );
  }
  return l;
}

function optionalProfile(raw: unknown) {
  const label = String(raw ?? '').trim();
  if (!label) return undefined;
  return CUSTOMER_PROFILE_FROM_LABEL[label];
}

function priceTierFor(
  rec: Base44SalesDataRecord,
  thresholds: PriceTierThresholds,
): PriceTier {
  // Preferência: campo fx do Base44 quando bate no enum em pt-BR.
  const fxLabel = String(rec.fx ?? '').trim();
  if (fxLabel) {
    const t = PRICE_TIER_FROM_LABEL[fxLabel];
    if (t) return t;
  }
  // Fallback: derivar do PM unitário (mesma lógica do CsvHistoricoConnector).
  const unit = rec.q > 0 ? rec.f / rec.q : 0;
  return priceTierFromValue(unit, thresholds);
}

function unitPriceOf(rec: Base44SalesDataRecord): number | undefined {
  if (typeof rec.q !== 'number' || rec.q <= 0) return undefined;
  return rec.f / rec.q;
}

function unitCostOf(rec: Base44SalesDataRecord): number | undefined {
  if (typeof rec.cu === 'number') return rec.cu;
  if (typeof rec.ct === 'number' && typeof rec.q === 'number' && rec.q > 0) {
    return rec.ct / rec.q;
  }
  return undefined;
}

function dateOf(rec: Base44SalesDataRecord): Date {
  const iso = rec.updated_date ?? rec.created_date;
  if (!iso) return new Date(0);
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : new Date(0);
}

/**
 * Mapper pra `SalesData` — formato flat sem collection. Define
 * `collection: 'V27'` por default; pra ingerir histórico com outras
 * coleções use `Sale` (que tem collectionCode próprio).
 */
export function makeSalesDataMapper(opts: {
  defaultCollection?: string;
  thresholds?: PriceTierThresholds;
} = {}) {
  const collection = opts.defaultCollection ?? 'V27';
  const thresholds = opts.thresholds ?? DEFAULT_PRICE_THRESHOLDS;

  return function mapSalesData(rec: Record<string, unknown>, idx: number): NormalizedSale {
    const r = rec as unknown as Base44SalesDataRecord;
    const brand = requireBrand(r.m, idx);
    const productLine = requireLine(r.l, idx);
    const priceTier = priceTierFor(r, thresholds);

    const productSku = String(r.p ?? '').trim();
    if (!productSku) {
      throw new ConnectorError(NAME, 'transform', `SKU vazio (linha ${idx + 1})`);
    }
    const customerId = String(r.c ?? '').trim() || `b44-anon-${idx}`;
    // ID determinístico se Base44 não fornecer (idempotência por upsert).
    const externalId = r.id ? `b44-sd-${r.id}` : `b44-sd-${productSku}-${customerId}-${r.q}-${r.f.toFixed(2)}`;
    const date = dateOf(r);

    return {
      externalId,
      productSku,
      productName: (r.dp ?? '').trim() || productSku,
      brand,
      productLine,
      productGroup: (r.g ?? '').trim() || 'OUTROS',
      coordSeason: (r.co ?? '').trim() || undefined,
      priceTier,
      designer: (r.est ?? '').trim() || undefined,
      unitPrice: unitPriceOf(r),
      customerId,
      customerName: (r.nm ?? '').trim() || customerId,
      customerProfile: optionalProfile(r.pf),
      repFullName: (r.rp ?? '').trim() || undefined,
      cityName: (r.cid ?? '').trim() || undefined,
      ufId: (r.uf ?? '').trim().toUpperCase() || 'XX',
      qty: r.q,
      value: r.f,
      cost: typeof r.ct === 'number' ? r.ct : undefined,
      unitCost: unitCostOf(r),
      date,
      sourceUpdatedAt: date,
      collection,
    };
  };
}

/**
 * Mapper pra `Sale` — formato richer com collectionCode + externalId.
 * Reconstrói o externalId final como `b44-${source}-${externalId}`
 * pra garantir unicidade quando múltiplas fontes Base44 alimentam o
 * mesmo painel.
 */
export function makeSaleMapper(opts: { thresholds?: PriceTierThresholds } = {}) {
  const thresholds = opts.thresholds ?? DEFAULT_PRICE_THRESHOLDS;

  return function mapSale(rec: Record<string, unknown>, idx: number): NormalizedSale {
    const r = rec as unknown as Base44SaleRecord;
    const collection = String(r.collectionCode ?? '').trim();
    if (!collection) {
      throw new ConnectorError(
        NAME,
        'transform',
        `Sale sem collectionCode (linha ${idx + 1}, id=${r.id ?? 'sem-id'})`,
      );
    }

    const brand = requireBrand(r.m, idx);
    const productLine = requireLine(r.l, idx);
    const priceTier = priceTierFor(r, thresholds);

    const productSku = String(r.p ?? '').trim();
    if (!productSku) {
      throw new ConnectorError(NAME, 'transform', `SKU vazio (linha ${idx + 1})`);
    }
    const customerId = String(r.c ?? '').trim() || `b44-anon-${idx}`;
    const baseExt = r.externalId?.trim() || r.id || `${productSku}-${customerId}-${idx}`;
    const sourcePrefix = (r.source ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const externalId = `b44-${sourcePrefix}-${baseExt}`;
    const date = dateOf(r);

    return {
      externalId,
      productSku,
      productName: (r.dp ?? '').trim() || productSku,
      brand,
      productLine,
      productGroup: (r.g ?? '').trim() || 'OUTROS',
      coordSeason: (r.co ?? '').trim() || undefined,
      priceTier,
      designer: (r.est ?? '').trim() || undefined,
      unitPrice: unitPriceOf(r),
      customerId,
      customerName: (r.nm ?? '').trim() || customerId,
      customerProfile: optionalProfile(r.pf),
      repFullName: (r.rp ?? '').trim() || undefined,
      cityName: (r.cid ?? '').trim() || undefined,
      ufId: (r.uf ?? '').trim().toUpperCase() || 'XX',
      qty: r.q,
      value: r.f,
      cost: typeof r.ct === 'number' ? r.ct : undefined,
      unitCost: unitCostOf(r),
      date,
      sourceUpdatedAt: date,
      collection,
    };
  };
}
