import { BRAND_LABEL, LINE_LABEL, type Brand, type ProductLine } from '@painel/shared';
import { AttackCard } from './attack-card';
import type { MapaCard } from '@/server/trpc/routers/mapa';

const BRAND_COLOR: Record<Brand, string> = {
  KIKI: '#a08366',
  MA: '#8b6a8a',
  VALENT: '#4a8b5a',
};

interface Bucket {
  label: string;
  cards: MapaCard[];
}

interface LinhaBlock {
  line: ProductLine;
  total: number;
  faixas: Bucket[];
}

interface BrandBlock {
  brand: Brand;
  skuCount: number;
  lines: LinhaBlock[];
}

export function AttackMap1({ data, faixas }: { data: BrandBlock[]; faixas: string[] }) {
  return (
    <div className="space-y-8">
      {data.map((brandBlock) => {
        const co = BRAND_COLOR[brandBlock.brand];
        return (
          <div
            key={brandBlock.brand}
            className="overflow-hidden rounded-xl border bg-paper"
            style={{ borderColor: `${co}40` }}
          >
            <div
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
              style={{ background: `${co}10`, borderColor: `${co}30` }}
            >
              <span className="rounded-md px-3 py-1 text-[0.85rem] font-bold tracking-wide text-paper" style={{ background: co }}>
                {BRAND_LABEL[brandBlock.brand]}
              </span>
              <span className="font-mono text-[0.72rem] text-ink-2">{brandBlock.skuCount} SKUs</span>
            </div>

            <div className="overflow-auto px-4 pb-4 pt-3">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="min-w-[140px] border border-amber/20 bg-beige/50 px-2 py-2 text-left font-display italic text-[0.62rem] font-semibold uppercase tracking-[0.8px] text-ink-3">
                      Linha
                    </th>
                    {faixas.map((f) => (
                      <th
                        key={f}
                        className="min-w-[100px] border border-amber/20 bg-beige/50 px-1 py-2 text-center font-display italic text-[0.62rem] font-semibold uppercase tracking-[0.6px] text-ink-3"
                      >
                        R$ {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brandBlock.lines.map((lineBlock) => (
                    <tr key={lineBlock.line}>
                      <td className="border border-amber/15 bg-beige/20 px-2.5 py-2 align-top text-[0.78rem] font-display font-semibold text-ink-2">
                        {LINE_LABEL[lineBlock.line]}
                        <br />
                        <span className="text-[0.55rem] font-normal text-ink-3">
                          {lineBlock.total} SKUs
                        </span>
                      </td>
                      {lineBlock.faixas.map((bucket) => (
                        <td
                          key={bucket.label}
                          className="border border-amber/15 p-1 align-top"
                          style={{
                            background: bucket.cards.length === 0 ? 'rgba(253,245,240,0.5)' : undefined,
                          }}
                        >
                          {bucket.cards.length === 0 ? (
                            <div className="py-3 text-center font-display text-[0.5rem] font-semibold uppercase tracking-[0.5px] text-amber/70">
                              gap
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {bucket.cards.map((card) => (
                                <AttackCard key={card.sku} card={card} />
                              ))}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
