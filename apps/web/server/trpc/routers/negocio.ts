import {
  FilterSchema,
  type Brand,
  type CustomerProfile,
  type Filter,
} from '@painel/shared';
import { db } from '@/lib/db';
import { router, requireAction } from '@/lib/trpc/server';

const PROFILE_ORDER: CustomerProfile[] = [
  'VIP_3PLUS',
  'VIP',
  'FREQUENTE',
  'REGULAR',
  'NOVO_25',
  'NOVO_27',
];

interface SaleRow {
  customerId: string;
  productSku: string;
  brand: Brand;
  ufId: string;
  qty: number;
  value: number;
  customerName: string;
  customerProfile: CustomerProfile;
  cityName: string | null;
}

export const negocioRouter = router({
  dashboard: requireAction('view:negocio')
    .input(FilterSchema)
    .query(async ({ input }) => {
      const sourceFilter = { source: 'fixture' as const };

      // Sales matching the full filter (every facet) — used for KPIs, top customers, marca share.
      const fullSales = await db.sale.findMany({
        where: buildSaleWhere(input, sourceFilter),
        select: {
          customerId: true,
          productSku: true,
          brand: true,
          ufId: true,
          qty: true,
          value: true,
          customer: { select: { name: true, profile: true } },
          city: { select: { name: true } },
        },
      });

      const X: SaleRow[] = fullSales.map((r) => ({
        customerId: r.customerId,
        productSku: r.productSku,
        brand: r.brand,
        ufId: r.ufId,
        qty: r.qty,
        value: Number(r.value),
        customerName: r.customer.name,
        customerProfile: r.customer.profile,
        cityName: r.city?.name ?? null,
      }));

      // Sales matching every facet *except* brand — that's the population
      // that defines "recurring customers in scope".
      const noBrandFilter = { ...input };
      delete noBrandFilter.brand;
      const dataMacro = await db.sale.findMany({
        where: buildSaleWhere(noBrandFilter, sourceFilter),
        select: {
          customerId: true,
          brand: true,
          value: true,
          customer: { select: { name: true, profile: true } },
        },
      });

      // V26 baseline (per customer × brand).
      const v26Rows = await db.customerBrandRevenue.findMany({
        where: { period: 'V26' },
        select: { customerId: true, brand: true, value: true },
      });
      const V26M = new Map<string, Partial<Record<Brand, number>>>();
      for (const r of v26Rows) {
        const m = V26M.get(r.customerId) ?? {};
        m[r.brand] = Number(r.value);
        V26M.set(r.customerId, m);
      }

      const ufYoY = await db.uF.findMany({ select: { id: true } });
      const ufRows = await db.sale.groupBy({
        by: ['ufId'],
        where: buildSaleWhere(input, sourceFilter),
        _sum: { value: true },
      });

      return {
        kpis: computeKpis(X),
        marcaShare: computeMarcaShare(X),
        sssMacro: computeSSSMacro(input.brand, dataMacro, V26M, X),
        sssByPerfil: computeSSSByPerfil(input.brand, dataMacro, V26M, X),
        topCustomers: computeTopCustomers(input.brand, dataMacro, V26M, X, 20),
        ufYoY: await computeUfYoY(input, sourceFilter, ufRows, V26M),
        validUfIds: ufYoY.map((u) => u.id),
      };
    }),
});

// ---------- query builder ----------

function buildSaleWhere(filter: Filter, base: { source: string }) {
  const where: Record<string, unknown> = { source: base.source };
  const f = filter;
  if (f.brand) where['brand'] = f.brand;
  if (f.ufId) where['ufId'] = f.ufId;
  if (f.repId) where['repId'] = f.repId;
  if (f.productGroup) where['productGroup'] = f.productGroup;
  if (f.line) where['productLine'] = f.line;
  if (f.priceTier) where['priceTier'] = f.priceTier;
  if (f.collection) where['collection'] = f.collection;
  return where;
}

// ---------- pure analytics ----------

function computeKpis(X: SaleRow[]) {
  const fat = X.reduce((s, r) => s + r.value, 0);
  const qtd = X.reduce((s, r) => s + r.qty, 0);
  const skus = new Set(X.map((r) => r.productSku)).size;
  const clientes = new Set(X.map((r) => r.customerId)).size;
  const pedidos = new Set(X.map((r) => `${r.productSku}|${r.customerId}`)).size;
  return {
    faturamento: fat,
    qtd,
    pm: qtd ? fat / qtd : 0,
    skus,
    clientes,
    pedidos,
  };
}

function computeMarcaShare(X: SaleRow[]) {
  const totals: Record<string, number> = {};
  let tot = 0;
  for (const r of X) {
    totals[r.brand] = (totals[r.brand] ?? 0) + r.value;
    tot += r.value;
  }
  const all: Brand[] = ['KIKI', 'MA', 'VALENT'];
  return all.map((brand) => ({
    brand,
    value: totals[brand] ?? 0,
    pct: tot ? ((totals[brand] ?? 0) / tot) * 100 : 0,
  }));
}

interface MacroSale {
  customerId: string;
  brand: Brand;
  value: number | { toNumber(): number } | { toString(): string };
  customer: { name: string; profile: CustomerProfile };
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

function computeSSSMacro(
  brand: Brand | undefined,
  dataMacro: MacroSale[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
  X: SaleRow[],
) {
  const cliInScope = new Set(dataMacro.map((r) => r.customerId));
  const recurring = [...cliInScope].filter((c) => V26M.has(c));

  const cliF26 = new Map<string, number>();
  const cliF27 = new Map<string, number>();
  for (const c of recurring) {
    cliF26.set(c, v26For(c, brand, V26M));
    cliF27.set(c, 0);
  }
  for (const r of dataMacro) {
    if (!cliF27.has(r.customerId)) continue;
    if (brand && r.brand !== brand) continue;
    cliF27.set(r.customerId, (cliF27.get(r.customerId) ?? 0) + Number(r.value));
  }

  const macroV26 = recurring.reduce((s, c) => s + (cliF26.get(c) ?? 0), 0);
  const macroV27 = recurring.reduce((s, c) => s + (cliF27.get(c) ?? 0), 0);
  const sssYoY = macroV26 ? ((macroV27 - macroV26) / macroV26) * 100 : 0;

  // Outliers: recurring customers whose V27 grew more than +100 % vs V26.
  const outliers = recurring.filter((c) => {
    const v26 = cliF26.get(c) ?? 0;
    const v27 = cliF27.get(c) ?? 0;
    return v26 > 0 && ((v27 - v26) / v26) * 100 > 100;
  });
  const normalRecurring = recurring.filter((c) => !outliers.includes(c));

  const v26Norm = normalRecurring.reduce((s, c) => s + (cliF26.get(c) ?? 0), 0);
  const v27Norm = normalRecurring.reduce((s, c) => s + (cliF27.get(c) ?? 0), 0);
  const v26Out = outliers.reduce((s, c) => s + (cliF26.get(c) ?? 0), 0);
  const v27Out = outliers.reduce((s, c) => s + (cliF27.get(c) ?? 0), 0);

  // New 27 customers: in X without any V26 baseline.
  const novosCli = new Set<string>();
  let novosF = 0;
  for (const r of X) {
    if (V26M.has(r.customerId)) continue;
    novosCli.add(r.customerId);
    novosF += r.value;
  }

  const v27TotalCarteira = X.reduce((s, r) => s + r.value, 0);

  return {
    recurringCount: recurring.length,
    v26: macroV26,
    v27: macroV27,
    sssYoY,
    novos: { count: novosCli.size, value: novosF },
    v27TotalCarteira,
    outliers:
      outliers.length > 0
        ? {
            count: outliers.length,
            v26: v26Out,
            v27: v27Out,
            sss: v26Out ? ((v27Out - v26Out) / v26Out) * 100 : 0,
            deltaShareOfYoy: macroV27 - macroV26 > 0 ? ((v27Out - v26Out) / (macroV27 - macroV26)) * 100 : 0,
          }
        : null,
    normalized:
      outliers.length > 0
        ? {
            count: normalRecurring.length,
            v26: v26Norm,
            v27: v27Norm,
            sss: v26Norm ? ((v27Norm - v26Norm) / v26Norm) * 100 : 0,
          }
        : null,
  };
}

function computeSSSByPerfil(
  brand: Brand | undefined,
  dataMacro: MacroSale[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
  X: SaleRow[],
) {
  // Build customer aggregates: recurring + new
  const cm = new Map<string, { profile: CustomerProfile; v26: number; v27: number; qty: number }>();
  for (const r of dataMacro) {
    if (!V26M.has(r.customerId)) continue;
    const cur = cm.get(r.customerId) ?? {
      profile: r.customer.profile,
      v26: v26For(r.customerId, brand, V26M),
      v27: 0,
      qty: 0,
    };
    if (!brand || r.brand === brand) cur.v27 += Number(r.value);
    cm.set(r.customerId, cur);
  }

  // Add NOVO 27 customers (label them as NOVO_27 regardless of stored profile).
  for (const r of X) {
    if (V26M.has(r.customerId)) continue;
    const cur = cm.get(r.customerId) ?? { profile: 'NOVO_27' as const, v26: 0, v27: 0, qty: 0 };
    cur.profile = 'NOVO_27';
    cur.v27 += r.value;
    cur.qty += r.qty;
    cm.set(r.customerId, cur);
  }

  const byProfile = new Map<CustomerProfile, { count: number; v26: number; v27: number }>();
  for (const c of cm.values()) {
    const cur = byProfile.get(c.profile) ?? { count: 0, v26: 0, v27: 0 };
    cur.count++;
    cur.v26 += c.v26;
    cur.v27 += c.v27;
    byProfile.set(c.profile, cur);
  }

  return PROFILE_ORDER.flatMap((p) => {
    const v = byProfile.get(p);
    if (!v || v.count === 0) return [];
    const varPct = v.v26 ? ((v.v27 - v.v26) / v.v26) * 100 : null;
    return [{
      profile: p,
      count: v.count,
      v26: v.v26,
      v27: v.v27,
      varPct,
      avgTicket: v.count ? v.v27 / v.count : 0,
    }];
  });
}

function computeTopCustomers(
  brand: Brand | undefined,
  dataMacro: MacroSale[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
  X: SaleRow[],
  limit: number,
) {
  const cm = new Map<
    string,
    {
      name: string;
      cityName: string | null;
      ufId: string;
      profile: CustomerProfile;
      v26: number;
      v27: number;
      brands: Set<Brand>;
    }
  >();

  for (const r of X) {
    const cur = cm.get(r.customerId) ?? {
      name: r.customerName,
      cityName: r.cityName,
      ufId: r.ufId,
      profile: V26M.has(r.customerId) ? r.customerProfile : 'NOVO_27',
      v26: V26M.has(r.customerId) ? v26For(r.customerId, brand, V26M) : 0,
      v27: 0,
      brands: new Set<Brand>(),
    };
    cur.v27 += r.value;
    cur.brands.add(r.brand);
    cm.set(r.customerId, cur);
  }

  return [...cm.entries()]
    .map(([id, c]) => ({
      id,
      name: c.name,
      cityName: c.cityName,
      ufId: c.ufId,
      profile: c.profile,
      v26: c.v26,
      v27: c.v27,
      varPct: c.v26 ? ((c.v27 - c.v26) / c.v26) * 100 : null,
      brandsCount: c.brands.size,
    }))
    .sort((a, b) => b.v27 - a.v27)
    .slice(0, limit);
}

async function computeUfYoY(
  filter: Filter,
  base: { source: string },
  v27Rows: { ufId: string; _sum: { value: import('@prisma/client/runtime/library').Decimal | null } }[],
  V26M: Map<string, Partial<Record<Brand, number>>>,
) {
  // Recurring customers per UF: those that have a V26 record AND have V27 sales in scope.
  const recurringByUf = new Map<string, Set<string>>();
  const cliRecSales = await db.sale.findMany({
    where: buildSaleWhere(filter, base),
    select: { customerId: true, ufId: true },
  });
  for (const r of cliRecSales) {
    if (!V26M.has(r.customerId)) continue;
    if (!recurringByUf.has(r.ufId)) recurringByUf.set(r.ufId, new Set());
    recurringByUf.get(r.ufId)!.add(r.customerId);
  }

  // V27 recurring per UF (only customers in V26M)
  const v27Recurring = new Map<string, number>();
  for (const r of cliRecSales) {
    if (!V26M.has(r.customerId)) continue;
  }
  const cliRecValues = await db.sale.findMany({
    where: { ...buildSaleWhere(filter, base), customerId: { in: [...V26M.keys()] } },
    select: { ufId: true, value: true, customerId: true },
  });
  for (const r of cliRecValues) {
    v27Recurring.set(r.ufId, (v27Recurring.get(r.ufId) ?? 0) + Number(r.value));
  }

  // V26 per UF: sum V26 across customers known to be in that UF (use any sale to map).
  const customerUfMap = new Map<string, string>();
  for (const r of cliRecSales) customerUfMap.set(r.customerId, r.ufId);

  const v26ByUf = new Map<string, number>();
  for (const [cid, ufId] of customerUfMap) {
    const m = V26M.get(cid);
    if (!m) continue;
    const total = Object.values(m).reduce((s, v) => s + (v ?? 0), 0);
    if (filter.brand) {
      const brand: Brand = filter.brand;
      v26ByUf.set(ufId, (v26ByUf.get(ufId) ?? 0) + (m[brand] ?? 0));
    } else {
      v26ByUf.set(ufId, (v26ByUf.get(ufId) ?? 0) + total);
    }
  }

  const totV27 = v27Rows.reduce((s, r) => s + Number(r._sum.value ?? 0), 0) || 1;
  const list = v27Rows
    .map((r) => {
      const v27 = Number(r._sum.value ?? 0);
      const v27Rec = v27Recurring.get(r.ufId) ?? 0;
      const v26 = v26ByUf.get(r.ufId) ?? 0;
      const cli = recurringByUf.get(r.ufId)?.size ?? 0;
      return {
        ufId: r.ufId,
        v26,
        v27,
        v27Recurring: v27Rec,
        delta: v27Rec - v26,
        sss: v26 ? ((v27Rec - v26) / v26) * 100 : 0,
        cliCount: cli,
        repPct: (v27 / totV27) * 100,
      };
    })
    .filter((r) => r.v27 > 0)
    .sort((a, b) => b.v27 - a.v27);

  return list;
}
