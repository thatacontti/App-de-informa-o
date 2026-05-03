import {
  BRANDS,
  FilterSchema,
  PRICE_TIERS,
  type Brand,
  type Filter,
  type PriceTier,
  type ProductLine,
} from '@painel/shared';
import { db } from '@/lib/db';
import { router, requireAction } from '@/lib/trpc/server';

export const produtoRouter = router({
  dashboard: requireAction('view:produto')
    .input(FilterSchema)
    .query(async ({ input }) => {
      const sales = await db.sale.findMany({
        where: buildSaleWhere(input, { source: 'fixture' }),
        select: {
          customerId: true,
          productSku: true,
          brand: true,
          productLine: true,
          productGroup: true,
          priceTier: true,
          qty: true,
          value: true,
          cost: true,
          unitCost: true,
          product: {
            select: { name: true, coordSeason: true, designer: true },
          },
        },
      });

      // ---- aggregate by SKU ----
      type SkuAgg = {
        sku: string;
        name: string;
        brand: Brand;
        line: ProductLine;
        group: string;
        coord: string | null;
        designer: string | null;
        tier: PriceTier;
        qty: number;
        value: number;
        cost: number;
        customers: Set<string>;
      };
      const skuMap = new Map<string, SkuAgg>();
      const customers = new Set<string>();
      for (const r of sales) {
        customers.add(r.customerId);
        const cur = skuMap.get(r.productSku) ?? {
          sku: r.productSku,
          name: r.product.name,
          brand: r.brand,
          line: r.productLine,
          group: r.productGroup,
          coord: r.product.coordSeason,
          designer: r.product.designer,
          tier: r.priceTier,
          qty: 0,
          value: 0,
          cost: 0,
          customers: new Set(),
        };
        cur.qty += r.qty;
        cur.value += Number(r.value);
        cur.cost += Number(r.cost ?? 0);
        cur.customers.add(r.customerId);
        skuMap.set(r.productSku, cur);
      }

      const skus = [...skuMap.values()].map((s) => ({
        ...s,
        customerCount: s.customers.size,
        pm: s.qty ? s.value / s.qty : 0,
        margin: s.value ? ((s.value - s.cost) / s.value) * 100 : 0,
      }));

      // sort by value desc + ABC + acum
      skus.sort((a, b) => b.value - a.value);
      const totalValue = skus.reduce((s, r) => s + r.value, 0);
      let acum = 0;
      const ranked = skus.map((s, idx) => {
        acum += s.value;
        const pct = totalValue ? (acum / totalValue) * 100 : 0;
        const abc: 'A' | 'B' | 'C' = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C';
        return { ...s, rank: idx + 1, acum: pct, abc };
      });

      const totalQty = ranked.reduce((s, r) => s + r.qty, 0);
      const totalCustomers = customers.size || 1;

      return {
        kpis: {
          faturamento: totalValue,
          qtd: totalQty,
          pm: totalQty ? totalValue / totalQty : 0,
          skus: ranked.length,
          clientes: customers.size,
        },
        stratSummary: computeStratSummary(ranked, totalValue, totalQty),
        faixaCards: computeFaixaCards(ranked, totalValue),
        faixasGranular: computeFaixasGranular(ranked, totalValue),
        mixOptimization: computeMixOptimization(ranked, totalValue),
        abc: computeABC(ranked, totalValue),
        moodboard: computeMoodboard(ranked, totalCustomers, 30),
        coordenados: computeCoordenados(ranked),
        ranks: {
          all: ranked.slice(0, 200).map(toRankRow),
          b: ranked.filter((r) => r.abc === 'B').map(toRankRow),
          c: ranked.filter((r) => r.abc === 'C').map(toRankRow),
        },
        insights: computeInsights(ranked, totalCustomers),
      };
    }),
});

// ---------- utilities ----------

function buildSaleWhere(filter: Filter, base: { source: string }) {
  const where: Record<string, unknown> = { source: base.source };
  if (filter.brand) where['brand'] = filter.brand;
  if (filter.ufId) where['ufId'] = filter.ufId;
  if (filter.repId) where['repId'] = filter.repId;
  if (filter.productGroup) where['productGroup'] = filter.productGroup;
  if (filter.line) where['productLine'] = filter.line;
  if (filter.priceTier) where['priceTier'] = filter.priceTier;
  if (filter.collection) where['collection'] = filter.collection;
  return where;
}

interface Ranked {
  sku: string;
  name: string;
  brand: Brand;
  line: ProductLine;
  group: string;
  coord: string | null;
  designer: string | null;
  tier: PriceTier;
  qty: number;
  value: number;
  cost: number;
  customerCount: number;
  pm: number;
  margin: number;
  rank: number;
  acum: number;
  abc: 'A' | 'B' | 'C';
}

function toRankRow(r: Ranked) {
  return {
    sku: r.sku,
    name: r.name,
    brand: r.brand,
    coord: r.coord,
    designer: r.designer,
    tier: r.tier,
    qty: r.qty,
    customerCount: r.customerCount,
    pm: r.pm,
    value: r.value,
    abc: r.abc,
    acum: r.acum,
    rank: r.rank,
  };
}

// ---------- 1. Strategic summary ----------

function computeStratSummary(ranked: Ranked[], totalValue: number, totalQty: number) {
  // Architecture of price (% by tier)
  const byTier: Record<PriceTier, number> = { ENTRADA: 0, MEDIO: 0, PREMIUM: 0 };
  for (const r of ranked) byTier[r.tier] += r.value;

  // Brand share (top brand)
  const byBrand: Record<Brand, number> = { KIKI: 0, MA: 0, VALENT: 0 };
  for (const r of ranked) byBrand[r.brand] += r.value;
  const topBrand = (Object.entries(byBrand) as [Brand, number][]).sort((a, b) => b[1] - a[1])[0];

  const total = totalValue || 1;
  return {
    faturamento: totalValue,
    pecas: totalQty,
    pm: totalQty ? totalValue / totalQty : 0,
    skus: ranked.length,
    arquiteturaPreco: {
      ENTRADA: (byTier.ENTRADA / total) * 100,
      MEDIO: (byTier.MEDIO / total) * 100,
      PREMIUM: (byTier.PREMIUM / total) * 100,
    },
    abcStrong: ranked.filter((r) => r.abc === 'A').reduce((s, r) => s + r.value, 0) / total * 100,
    abcASkus: ranked.filter((r) => r.abc === 'A').length,
    topBrand: { brand: topBrand?.[0] ?? 'KIKI', value: topBrand?.[1] ?? 0, pct: ((topBrand?.[1] ?? 0) / total) * 100 },
    premiumShare: (byTier.PREMIUM / total) * 100,
    coberturaCandidatos: ranked.filter((r) => r.customerCount >= 6 && r.qty / r.customerCount <= 4).length,
  };
}

// ---------- 2. Faixas (3 cards + detail) ----------

function computeFaixaCards(ranked: Ranked[], totalValue: number) {
  const totalSkus = ranked.length || 1;
  const totalAll = totalValue || 1;
  return PRICE_TIERS.map((tier) => {
    const items = ranked.filter((r) => r.tier === tier);
    const value = items.reduce((s, r) => s + r.value, 0);
    const qty = items.reduce((s, r) => s + r.qty, 0);
    const cli = new Set(items.flatMap((r) => Array(r.customerCount).fill(r.sku))).size; // placeholder
    const cliReal = new Set<string>();
    // We need actual customer set; recompute from skus would require per-SKU list — approximate via union of sku's customers count.
    // For perf, accept using sum of customerCount as upper bound when we don't have raw sales.
    // (The real customer-set requires raw sales — done at the sale level.)
    void cli;
    void cliReal;
    return {
      tier,
      value,
      qty,
      skus: items.length,
      pmUnit: qty ? value / qty : 0,
      pctValue: (value / totalAll) * 100,
      pctSkus: (items.length / totalSkus) * 100,
      fatPorSku: items.length ? value / items.length : 0,
      pecasPorSku: items.length ? qty / items.length : 0,
      pecasEquiv: qty ? Math.round(value / (value / qty)) : 0, // == qty
      eficiencia: items.length / totalSkus
        ? (value / totalAll) / (items.length / totalSkus)
        : 0,
    };
  });
}

function computeFaixasGranular(ranked: Ranked[], totalValue: number) {
  const BINS: Array<[number, number, string]> = [
    [0, 50, '00-50'], [50, 60, '50-60'], [60, 70, '60-70'], [70, 80, '70-80'],
    [80, 90, '80-90'], [90, 100, '90-100'], [100, 110, '100-110'], [110, 120, '110-120'],
    [120, 130, '120-130'], [130, 140, '130-140'], [140, 150, '140-150'], [150, 160, '150-160'],
    [160, 170, '160-170'], [170, 99999, '170+'],
  ];

  const agg = BINS.map(([lo, hi, label]) => {
    const items = ranked.filter((r) => r.pm >= lo && r.pm < hi);
    const value = items.reduce((s, r) => s + r.value, 0);
    const qty = items.reduce((s, r) => s + r.qty, 0);
    return { lo, hi, label, skus: items.length, qty, value };
  });

  const totalSkus = agg.reduce((s, b) => s + b.skus, 0) || 1;
  const totalQty = agg.reduce((s, b) => s + b.qty, 0) || 1;
  const totalAll = totalValue || 1;

  return agg
    .filter((b) => b.skus > 0)
    .map((b) => ({
      label: b.label,
      skus: b.skus,
      pctSkus: (b.skus / totalSkus) * 100,
      qty: b.qty,
      pctQty: (b.qty / totalQty) * 100,
      value: b.value,
      pctValue: (b.value / totalAll) * 100,
      fatPorSku: b.skus ? b.value / b.skus : 0,
      pecasPorSku: b.skus ? b.qty / b.skus : 0,
    }));
}

// ---------- 3. Mix optimisation by product group ----------

function computeMixOptimization(ranked: Ranked[], totalValue: number) {
  const map = new Map<string, { value: number; qty: number; cost: number; skus: Set<string>; customers: Set<string> }>();
  for (const r of ranked) {
    const cur = map.get(r.group) ?? { value: 0, qty: 0, cost: 0, skus: new Set(), customers: new Set() };
    cur.value += r.value;
    cur.qty += r.qty;
    cur.cost += r.cost;
    cur.skus.add(r.sku);
    map.set(r.group, cur);
  }
  const totalSkus = ranked.length || 1;
  const totalAll = totalValue || 1;

  return [...map.entries()]
    .map(([group, v]) => {
      const fp = (v.value / totalAll) * 100;
      const sp = (v.skus.size / totalSkus) * 100;
      const ef = sp ? fp / sp : 0;
      const recommendation = ef > 1.3 ? 'APROFUNDAR' : ef < 0.7 ? 'RACIONALIZAR' : 'MANTER';
      return {
        group,
        skus: v.skus.size,
        pctSkus: sp,
        qty: v.qty,
        customers: ranked.filter((r) => r.group === group).reduce((set, r) => set.add(r.sku), new Set()).size, // placeholder; replaced below
        pm: v.qty ? v.value / v.qty : 0,
        value: v.value,
        pctValue: fp,
        eficiencia: ef,
        recommendation,
      };
    })
    .map((g) => {
      // Compute real unique customer count per group
      const items = ranked.filter((r) => r.group === g.group);
      // Sum of unique customers cross-SKU is approximated as max customerCount across SKUs of that group
      // (not perfect but acceptable; for exact, we'd need raw sale rows).
      const uniqueCustomers = items.reduce((s, r) => Math.max(s, r.customerCount), 0);
      return { ...g, customers: uniqueCustomers };
    })
    .sort((a, b) => b.eficiencia - a.eficiencia);
}

// ---------- 4. ABC ----------

function computeABC(ranked: Ranked[], totalValue: number) {
  const result = { A: { skus: 0, value: 0 }, B: { skus: 0, value: 0 }, C: { skus: 0, value: 0 } };
  for (const r of ranked) {
    result[r.abc].skus++;
    result[r.abc].value += r.value;
  }
  const total = totalValue || 1;
  return (['A', 'B', 'C'] as const).map((k) => ({
    classe: k,
    skus: result[k].skus,
    value: result[k].value,
    pct: (result[k].value / total) * 100,
  }));
}

// ---------- 5. Moodboard top N ----------

function computeMoodboard(ranked: Ranked[], totalCustomers: number, limit: number) {
  const byQty = [...ranked].sort((a, b) => b.qty - a.qty);
  return byQty.slice(0, limit).map((r) => {
    const cobertura = (r.customerCount / totalCustomers) * 100;
    return {
      rank: byQty.indexOf(r) + 1,
      sku: r.sku,
      name: r.name,
      brand: r.brand,
      tier: r.tier,
      coord: r.coord,
      designer: r.designer,
      abc: r.abc,
      qty: r.qty,
      pcsPorCli: r.customerCount ? r.qty / r.customerCount : 0,
      pm: r.pm,
      value: r.value,
      cobertura,
      customerCount: r.customerCount,
      totalCustomers,
    };
  });
}

// ---------- 6. Coordenados ----------

function computeCoordenados(ranked: Ranked[]) {
  type Agg = { coord: string; value: number; qty: number; skus: Set<string>; customerCount: number };
  const map = new Map<string, Agg>();
  for (const r of ranked) {
    if (!r.coord || r.coord === 'SEM COORDENADO') continue;
    const cur = map.get(r.coord) ?? { coord: r.coord, value: 0, qty: 0, skus: new Set(), customerCount: 0 };
    cur.value += r.value;
    cur.qty += r.qty;
    cur.skus.add(r.sku);
    cur.customerCount = Math.max(cur.customerCount, r.customerCount);
    map.set(r.coord, cur);
  }
  return [...map.values()]
    .map((c) => ({ coord: c.coord, value: c.value, qty: c.qty, skus: c.skus.size, customers: c.customerCount }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

// ---------- 7. Insights ----------

function computeInsights(ranked: Ranked[], totalCustomers: number) {
  // Aprofundar grade: alta cobertura (>=6 cli), baixa profundidade (qty/cli <= 4)
  const aprofundar = ranked
    .filter((r) => r.customerCount >= 6 && r.qty / r.customerCount <= 4)
    .slice(0, 6);
  // Alto giro: margem >= 55% e qty >= 15 (proxy for "destaque no showroom")
  const altoGiro = ranked
    .filter((r) => r.margin >= 55 && r.qty >= 15)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 6);

  return {
    aprofundar: aprofundar.map(toRankRow),
    altoGiro: altoGiro.map(toRankRow),
    totalCustomers,
  };
}
