import {
  BRANDS,
  FilterSchema,
  LINES,
  type Brand,
  type Filter,
  type PriceTier,
  type ProductLine,
} from '@painel/shared';
import { db } from '@/lib/db';
import { router, requireAction } from '@/lib/trpc/server';

// 6 mapa-specific PM bins (different from the 14 bins in the Produto tab).
export const MAPA_FAIXAS: ReadonlyArray<{ lo: number; hi: number; label: string }> = [
  { lo: 0, hi: 50, label: '00-50' },
  { lo: 50, hi: 70, label: '50-70' },
  { lo: 70, hi: 90, label: '70-90' },
  { lo: 90, hi: 110, label: '90-110' },
  { lo: 110, hi: 130, label: '110-130' },
  { lo: 130, hi: 99_999, label: '130+' },
];

export interface MapaCard {
  sku: string;
  name: string;
  pm: number;
  qty: number;
  value: number;
  tier: PriceTier;
  designer: string | null;
}

function pmBin(pm: number): string {
  for (const f of MAPA_FAIXAS) if (pm >= f.lo && pm < f.hi) return f.label;
  return MAPA_FAIXAS[MAPA_FAIXAS.length - 1]!.label;
}

export const mapaRouter = router({
  dashboard: requireAction('view:mapa')
    .input(FilterSchema)
    .query(async ({ input }) => {
      const sales = await db.sale.findMany({
        where: buildSaleWhere(input),
        select: {
          productSku: true,
          brand: true,
          productLine: true,
          productGroup: true,
          priceTier: true,
          qty: true,
          value: true,
          product: { select: { name: true, designer: true } },
        },
      });

      type SkuAgg = MapaCard & {
        brand: Brand;
        line: ProductLine;
        group: string;
      };
      const skuMap = new Map<string, SkuAgg>();
      for (const r of sales) {
        const cur = skuMap.get(r.productSku) ?? {
          sku: r.productSku,
          name: r.product.name,
          brand: r.brand,
          line: r.productLine,
          group: r.productGroup,
          tier: r.priceTier,
          designer: r.product.designer,
          qty: 0,
          value: 0,
          pm: 0,
        };
        cur.qty += r.qty;
        cur.value += Number(r.value);
        skuMap.set(r.productSku, cur);
      }
      for (const s of skuMap.values()) s.pm = s.qty ? s.value / s.qty : 0;

      const skus = [...skuMap.values()].sort((a, b) => a.pm - b.pm);

      const totalSkus = skus.length;
      const totalValue = skus.reduce((s, r) => s + r.value, 0);
      const totalQty = skus.reduce((s, r) => s + r.qty, 0);

      // ---- Mapa 1: Marca → Linha → Faixa ----
      type Bucket = { label: string; cards: MapaCard[] };
      type LinhaBlock = { line: ProductLine; total: number; faixas: Bucket[] };
      type BrandBlock = { brand: Brand; skuCount: number; lines: LinhaBlock[] };
      const map1: BrandBlock[] = BRANDS.flatMap((brand) => {
        const items = skus.filter((s) => s.brand === brand);
        if (items.length === 0) return [];
        const lines: LinhaBlock[] = LINES.flatMap((line) => {
          const lineItems = items.filter((s) => s.line === line);
          if (lineItems.length === 0) return [];
          const faixas: Bucket[] = MAPA_FAIXAS.map((f) => ({
            label: f.label,
            cards: lineItems
              .filter((s) => s.pm >= f.lo && s.pm < f.hi)
              .sort((a, b) => a.pm - b.pm)
              .map(toCard),
          }));
          return [{ line, total: lineItems.length, faixas }];
        });
        return [{ brand, skuCount: items.length, lines }];
      });

      // ---- Mapa 2: Marca → Linha → Tipo (sorted by qty desc) → Faixa ----
      type TipoBlock = { tipo: string; total: number; faixas: Bucket[] };
      type LinhaBlock2 = { line: ProductLine; total: number; tipos: TipoBlock[] };
      type BrandBlock2 = { brand: Brand; skuCount: number; lines: LinhaBlock2[] };
      const map2: BrandBlock2[] = BRANDS.flatMap((brand) => {
        const items = skus.filter((s) => s.brand === brand);
        if (items.length === 0) return [];
        const lines: LinhaBlock2[] = LINES.flatMap((line) => {
          const lineItems = items.filter((s) => s.line === line);
          if (lineItems.length === 0) return [];
          const tiposByQty = new Map<string, number>();
          for (const it of lineItems) tiposByQty.set(it.group, (tiposByQty.get(it.group) ?? 0) + it.qty);
          const tipos: TipoBlock[] = [...tiposByQty.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([tipo]) => {
              const tipoItems = lineItems.filter((s) => s.group === tipo);
              return {
                tipo,
                total: tipoItems.length,
                faixas: MAPA_FAIXAS.map((f) => ({
                  label: f.label,
                  cards: tipoItems
                    .filter((s) => s.pm >= f.lo && s.pm < f.hi)
                    .sort((a, b) => a.pm - b.pm)
                    .map(toCard),
                })),
              };
            });
          return [{ line, total: lineItems.length, tipos }];
        });
        return [{ brand, skuCount: items.length, lines }];
      });

      return {
        kpis: {
          totalSkus,
          totalQty,
          totalValue,
        },
        faixas: MAPA_FAIXAS.map((f) => f.label),
        map1,
        map2,
      };
    }),
});

function toCard(s: { sku: string; name: string; pm: number; qty: number; value: number; tier: PriceTier; designer: string | null }): MapaCard {
  return {
    sku: s.sku,
    name: s.name,
    pm: s.pm,
    qty: s.qty,
    value: s.value,
    tier: s.tier,
    designer: s.designer,
  };
}

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

export { pmBin };
