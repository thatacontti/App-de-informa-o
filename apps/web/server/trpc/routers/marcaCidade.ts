import {
  BRANDS,
  FilterSchema,
  LINES,
  type Brand,
  type CustomerProfile,
  type Filter,
  type IbgePopulationTier,
  type ProductLine,
} from '@painel/shared';
import { db } from '@/lib/db';
import { router, requireAction } from '@/lib/trpc/server';
import { loadBaseline } from './_baseline';

const PROFILE_ORDER: CustomerProfile[] = [
  'VIP_3PLUS',
  'VIP',
  'FREQUENTE',
  'REGULAR',
  'NOVO_27',
];

const IBGE_ORDER: IbgePopulationTier[] = ['METRO', 'GRANDE', 'MEDIA', 'PEQUENA', 'MICRO'];

interface RawSale {
  customerId: string;
  cityId: string | null;
  ufId: string;
  brand: Brand;
  productLine: ProductLine;
  qty: number;
  value: number;
  customerProfile: CustomerProfile;
  cityName: string | null;
  ibgeTier: IbgePopulationTier | null;
}

export const marcaCidadeRouter = router({
  dashboard: requireAction('view:marca-cidade')
    .input(FilterSchema)
    .query(async ({ input }) => {
      const fullSales = await db.sale.findMany({
        where: buildSaleWhere(input),
        select: {
          customerId: true,
          cityId: true,
          ufId: true,
          brand: true,
          productLine: true,
          qty: true,
          value: true,
          customer: { select: { profile: true } },
          city: { select: { name: true, ibgeTier: true } },
        },
      });
      const X: RawSale[] = fullSales.map((r) => ({
        customerId: r.customerId,
        cityId: r.cityId,
        ufId: r.ufId,
        brand: r.brand,
        productLine: r.productLine,
        qty: r.qty,
        value: Number(r.value),
        customerProfile: r.customer.profile,
        cityName: r.city?.name ?? null,
        ibgeTier: r.city?.ibgeTier ?? null,
      }));

      // Sales without the brand filter — used to define "recurring customers
      // in scope" symmetrically across both legs of every SSS calc.
      const noBrandFilter = { ...input };
      delete noBrandFilter.brand;
      const dataMacro = await db.sale.findMany({
        where: buildSaleWhere(noBrandFilter),
        select: { customerId: true, brand: true, productLine: true, value: true },
      });

      // Baseline (per customer × brand) — V26 do CustomerBrandRevenue
      // por padrão, ou somatório do Sale na coleção escolhida quando o
      // usuário pediu uma comparação ano-a-ano qualquer.
      const V26M = await loadBaseline(db, input.compareCollection);

      const recurringSet = new Set<string>();
      for (const r of dataMacro) if (V26M.has(r.customerId)) recurringSet.add(r.customerId);

      return {
        sssMarca: computeSssMarca(input.brand, dataMacro, V26M, recurringSet),
        sssMarcaLinha: computeSssMarcaLinha(dataMacro, V26M, recurringSet),
        sssLinha: computeSssLinha(input.brand, dataMacro, V26M, recurringSet),
        cityIbge: computeCityIbge(input.brand, X, V26M),
        cityProfile: computeCityProfile(X),
        brandByProfile: computeBrandByProfile(X),
        topCities: computeTopCities(X),
        comparison: {
          baseline: input.compareCollection ?? 'V26',
          current: input.collection ?? 'V27',
        },
      };
    }),
});

function buildSaleWhere(filter: Filter) {
  const where: Record<string, unknown> = {};
  if (filter.brand) where['brand'] = filter.brand;
  if (filter.ufId) where['ufId'] = filter.ufId;
  if (filter.repId) where['repId'] = filter.repId;
  if (filter.productGroup) where['productGroup'] = filter.productGroup;
  if (filter.line) where['productLine'] = filter.line;
  if (filter.priceTier) where['priceTier'] = filter.priceTier;
  if (filter.collection) where['collection'] = filter.collection;
  return where;
}

interface MacroRow {
  customerId: string;
  brand: Brand;
  productLine: ProductLine;
  value: number | { toNumber(): number } | { toString(): string };
}

function v26For(
  customerId: string,
  brandFilter: Brand | undefined,
  V26M: Map<string, Partial<Record<Brand, number>>>,
): number {
  const m = V26M.get(customerId);
  if (!m) return 0;
  if (brandFilter) return m[brandFilter] ?? 0;
  return Object.values(m).reduce((s, v) => s + (v ?? 0), 0);
}

// ---------- 1. SSS por Marca ----------
function computeSssMarca(
  brandFilter: Brand | undefined,
  dataMacro: MacroRow[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
  recurringSet: Set<string>,
) {
  return BRANDS.map((m) => {
    let f26 = 0;
    let f27 = 0;
    for (const cid of recurringSet) {
      const v = V26M.get(cid)?.[m];
      if (v) f26 += v;
    }
    for (const r of dataMacro) {
      if (r.brand === m && recurringSet.has(r.customerId)) f27 += Number(r.value);
    }
    const varPct = f26 ? ((f27 - f26) / f26) * 100 : 0;
    return { brand: m, v26: f26, v27: f27, varPct };
  });
}

// ---------- 2. SSS por Marca × Linha ----------
function computeSssMarcaLinha(
  dataMacro: MacroRow[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
  recurringSet: Set<string>,
) {
  type Cell = { v27: number };
  const matrix: Record<Brand, { v26: number; v27Total: number; lines: Record<ProductLine, Cell> }> = {
    KIKI: { v26: 0, v27Total: 0, lines: { BEBE: { v27: 0 }, PRIMEIROS_PASSOS: { v27: 0 }, INFANTIL: { v27: 0 }, TEEN: { v27: 0 } } },
    MA: { v26: 0, v27Total: 0, lines: { BEBE: { v27: 0 }, PRIMEIROS_PASSOS: { v27: 0 }, INFANTIL: { v27: 0 }, TEEN: { v27: 0 } } },
    VALENT: { v26: 0, v27Total: 0, lines: { BEBE: { v27: 0 }, PRIMEIROS_PASSOS: { v27: 0 }, INFANTIL: { v27: 0 }, TEEN: { v27: 0 } } },
  };

  for (const m of BRANDS) {
    for (const cid of recurringSet) matrix[m].v26 += V26M.get(cid)?.[m] ?? 0;
  }
  for (const r of dataMacro) {
    if (!recurringSet.has(r.customerId)) continue;
    const cell = matrix[r.brand].lines[r.productLine];
    cell.v27 += Number(r.value);
    matrix[r.brand].v27Total += Number(r.value);
  }

  return BRANDS.map((m) => ({
    brand: m,
    v26: matrix[m].v26,
    v27: matrix[m].v27Total,
    sss: matrix[m].v26 ? ((matrix[m].v27Total - matrix[m].v26) / matrix[m].v26) * 100 : 0,
    lines: LINES.map((l) => {
      const v = matrix[m].lines[l].v27;
      return { line: l, value: v, pctOfBrand: matrix[m].v27Total ? (v / matrix[m].v27Total) * 100 : 0 };
    }),
  }));
}

// ---------- 3. SSS por Linha (cards) ----------
function computeSssLinha(
  brandFilter: Brand | undefined,
  dataMacro: MacroRow[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
  recurringSet: Set<string>,
) {
  return LINES.map((line) => {
    const cliLinha = new Set<string>();
    for (const r of dataMacro) {
      if (r.productLine === line && recurringSet.has(r.customerId)) cliLinha.add(r.customerId);
    }
    if (cliLinha.size === 0) {
      return { line, v27: 0, v26Est: 0, sss: 0, customerCount: 0, byBrand: {} as Record<Brand, number> };
    }
    let f27Line = 0;
    let f27Total = 0;
    for (const r of dataMacro) {
      if (!cliLinha.has(r.customerId)) continue;
      if (brandFilter && r.brand !== brandFilter) continue;
      const v = Number(r.value);
      f27Total += v;
      if (r.productLine === line) f27Line += v;
    }
    let f26Total = 0;
    for (const cid of cliLinha) f26Total += v26For(cid, brandFilter, V26M);
    const peso = f27Total > 0 ? f27Line / f27Total : 0;
    const f26Est = f26Total * peso;
    const sss = f26Est ? ((f27Line - f26Est) / f26Est) * 100 : 0;

    const byBrand: Record<Brand, number> = { KIKI: 0, MA: 0, VALENT: 0 };
    for (const r of dataMacro) {
      if (r.productLine === line && cliLinha.has(r.customerId)) byBrand[r.brand] += Number(r.value);
    }

    return { line, v27: f27Line, v26Est: f26Est, sss, customerCount: cliLinha.size, byBrand };
  });
}

// ---------- 4. Performance por perfil de cidade IBGE ----------
function computeCityIbge(
  brandFilter: Brand | undefined,
  X: RawSale[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
) {
  const agg = new Map<
    IbgePopulationTier,
    { cities: Set<string>; customers: Set<string>; v27Total: number; v27Recurring: number; v26: number }
  >();
  const seenV26 = new Map<IbgePopulationTier, Set<string>>();

  for (const r of X) {
    const tier = r.ibgeTier ?? 'MICRO';
    const cur = agg.get(tier) ?? {
      cities: new Set<string>(),
      customers: new Set<string>(),
      v27Total: 0,
      v27Recurring: 0,
      v26: 0,
    };
    if (r.cityId) cur.cities.add(r.cityId);
    cur.customers.add(r.customerId);
    cur.v27Total += r.value;
    if (V26M.has(r.customerId)) {
      cur.v27Recurring += r.value;
      const seen = seenV26.get(tier) ?? new Set<string>();
      if (!seen.has(r.customerId)) {
        seen.add(r.customerId);
        cur.v26 += v26For(r.customerId, brandFilter, V26M);
      }
      seenV26.set(tier, seen);
    }
    agg.set(tier, cur);
  }

  const grandTotal = [...agg.values()].reduce((s, v) => s + v.v27Total, 0) || 1;
  return IBGE_ORDER.flatMap((tier) => {
    const v = agg.get(tier);
    if (!v || v.customers.size === 0) return [];
    return [{
      tier,
      cities: v.cities.size,
      customers: v.customers.size,
      v26: v.v26,
      v27Total: v.v27Total,
      v27Recurring: v.v27Recurring,
      sss: v.v26 ? ((v.v27Recurring - v.v26) / v.v26) * 100 : 0,
      repPct: (v.v27Total / grandTotal) * 100,
    }];
  });
}

// ---------- 5. cp-cards: cidades agrupadas por perfil de cliente dominante ----------
function computeCityProfile(X: RawSale[]) {
  // For each city, dominant customer profile.
  type CityAgg = { cityId: string; profileSums: Map<CustomerProfile, number>; v27: number; qty: number; customers: Set<string> };
  const cities = new Map<string, CityAgg>();
  for (const r of X) {
    if (!r.cityId) continue;
    const cur = cities.get(r.cityId) ?? {
      cityId: r.cityId,
      profileSums: new Map(),
      v27: 0,
      qty: 0,
      customers: new Set(),
    };
    cur.profileSums.set(r.customerProfile, (cur.profileSums.get(r.customerProfile) ?? 0) + r.value);
    cur.v27 += r.value;
    cur.qty += r.qty;
    cur.customers.add(r.customerId);
    cities.set(r.cityId, cur);
  }

  type CardAgg = { cities: number; customers: Set<string>; v27: number; qty: number };
  const byProfile = new Map<CustomerProfile, CardAgg>();
  // Mirror the prototype's ORD2 — cities whose dominant profile is
  // outside the curated set (NOVO_25 specifically) are not surfaced.
  const KEEP = new Set<CustomerProfile>(PROFILE_ORDER);
  for (const c of cities.values()) {
    const dominant = [...c.profileSums.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    if (!KEEP.has(dominant)) continue;
    const cur = byProfile.get(dominant) ?? { cities: 0, customers: new Set(), v27: 0, qty: 0 };
    cur.cities++;
    for (const cust of c.customers) cur.customers.add(cust);
    cur.v27 += c.v27;
    cur.qty += c.qty;
    byProfile.set(dominant, cur);
  }

  const total = [...byProfile.values()].reduce((s, v) => s + v.v27, 0) || 1;
  return PROFILE_ORDER.flatMap((p) => {
    const v = byProfile.get(p);
    if (!v) return [];
    return [{
      profile: p,
      cities: v.cities,
      customers: v.customers.size,
      qty: v.qty,
      v27: v.v27,
      pmUnit: v.qty ? v.v27 / v.qty : 0,
      pctOfTotal: (v.v27 / total) * 100,
    }];
  });
}

// ---------- 6. Matriz Marca × Perfil de cidade ----------
function computeBrandByProfile(X: RawSale[]) {
  // Re-compute dominant city profile (cheap on a small set).
  const cityDominant = new Map<string, CustomerProfile>();
  const cityProfiles = new Map<string, Map<CustomerProfile, number>>();
  for (const r of X) {
    if (!r.cityId) continue;
    const m = cityProfiles.get(r.cityId) ?? new Map<CustomerProfile, number>();
    m.set(r.customerProfile, (m.get(r.customerProfile) ?? 0) + r.value);
    cityProfiles.set(r.cityId, m);
  }
  for (const [cid, m] of cityProfiles) {
    cityDominant.set(cid, [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
  }

  const matrix = new Map<string, number>();
  const rowTotals: Record<Brand, number> = { KIKI: 0, MA: 0, VALENT: 0 };
  const colTotals = new Map<CustomerProfile, number>();
  const KEEP = new Set<CustomerProfile>(PROFILE_ORDER);

  for (const r of X) {
    if (!r.cityId) continue;
    const profile = cityDominant.get(r.cityId);
    if (!profile || !KEEP.has(profile)) continue;
    const key = `${r.brand}|${profile}`;
    matrix.set(key, (matrix.get(key) ?? 0) + r.value);
    rowTotals[r.brand] += r.value;
    colTotals.set(profile, (colTotals.get(profile) ?? 0) + r.value);
  }

  const profilesPresent = PROFILE_ORDER.filter((p) => (colTotals.get(p) ?? 0) > 0);
  const grandTotal = [...colTotals.values()].reduce((s, v) => s + v, 0);

  return {
    profiles: profilesPresent,
    rows: BRANDS.map((b) => ({
      brand: b,
      cells: profilesPresent.map((p) => matrix.get(`${b}|${p}`) ?? 0),
      total: rowTotals[b],
    })),
    columnTotals: profilesPresent.map((p) => colTotals.get(p) ?? 0),
    grandTotal,
  };
}

// ---------- 7. Top 15 cidades ----------
function computeTopCities(X: RawSale[]) {
  type Agg = {
    cityId: string;
    cityName: string;
    ufId: string;
    v27: number;
    qty: number;
    customers: Set<string>;
    profileSums: Map<CustomerProfile, number>;
  };
  const map = new Map<string, Agg>();
  for (const r of X) {
    if (!r.cityId || !r.cityName) continue;
    const cur = map.get(r.cityId) ?? {
      cityId: r.cityId,
      cityName: r.cityName,
      ufId: r.ufId,
      v27: 0,
      qty: 0,
      customers: new Set(),
      profileSums: new Map(),
    };
    cur.v27 += r.value;
    cur.qty += r.qty;
    cur.customers.add(r.customerId);
    cur.profileSums.set(r.customerProfile, (cur.profileSums.get(r.customerProfile) ?? 0) + r.value);
    map.set(r.cityId, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.v27 - a.v27)
    .slice(0, 15)
    .map((c) => ({
      cityId: c.cityId,
      cityName: c.cityName,
      ufId: c.ufId,
      v27: c.v27,
      qty: c.qty,
      customers: c.customers.size,
      dominantProfile: [...c.profileSums.entries()].sort((a, b) => b[1] - a[1])[0]![0],
    }));
}
