import {
  BRAND_LABEL,
  fmtBRL,
  fmtNum,
  type Brand,
  type PriceTier,
} from '@painel/shared';
import { cn } from '@/lib/utils';

const BRAND_PILL: Record<Brand, string> = {
  KIKI: 'bg-[#fddcc8] text-terra',
  MA: 'bg-[#eadcc5] text-ink-2',
  VALENT: 'bg-[#d8c5a8] text-deep',
};

const TIER_PILL: Record<PriceTier, string> = {
  ENTRADA: 'bg-[#a08366] text-paper',
  MEDIO: 'bg-burnt text-paper',
  PREMIUM: 'bg-deep text-paper',
};

const TIER_LABEL: Record<PriceTier, string> = {
  ENTRADA: 'ENTRADA',
  MEDIO: 'MÉDIO',
  PREMIUM: 'PREMIUM',
};

const ABC_COLOR: Record<string, string> = {
  A: 'bg-rust',
  B: 'bg-amber',
  C: 'bg-ink-3',
};

export interface RankRow {
  sku: string;
  name: string;
  brand: Brand;
  coord: string | null;
  designer: string | null;
  tier: PriceTier;
  qty: number;
  customerCount: number;
  pm: number;
  value: number;
  abc: 'A' | 'B' | 'C';
  acum: number;
  rank: number;
}

export function RankTable({
  data,
  showAbc = true,
}: {
  data: RankRow[];
  showAbc?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-amber/15 bg-paper px-4 py-8 text-center font-display italic text-ink-3">
        Sem SKUs neste recorte
      </div>
    );
  }

  return (
    <div className="max-h-[540px] overflow-auto rounded-[10px] border border-amber/15">
      <table className="w-full text-[0.82rem]">
        <thead className="sticky top-0 bg-beige/80 backdrop-blur">
          <tr className="border-b-2 border-amber/30">
            {[
              '#', 'SKU/Produto', 'Marca', 'Faixa',
              ...(showAbc ? ['ABC'] : []),
              'Pç', 'Cli', 'PM', 'Faturamento', '% Acum',
            ].map((h, i) => {
              const isRight = ['Pç', 'Cli', 'PM', 'Faturamento', '% Acum'].includes(h);
              return (
                <th
                  key={h}
                  className={cn(
                    'px-2.5 py-2.5 font-display italic text-[0.72rem] tracking-wide text-terra',
                    isRight ? 'text-right' : 'text-left',
                  )}
                >
                  {h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.sku} className="border-b border-amber/10 hover:bg-beige/30">
              <td className="px-2.5 py-2 font-mono text-[0.74rem] font-semibold text-ink-3">#{i + 1}</td>
              <td className="px-2.5 py-2">
                <div className="font-mono text-[0.72rem] font-bold text-terra">{r.sku}</div>
                {r.designer && (
                  <div className="text-[0.58rem] font-semibold text-[#8b6a8a]">{r.designer}</div>
                )}
                <div className="text-[0.8rem] text-ink-1">
                  {r.name}
                  {r.coord && r.coord !== 'SEM COORDENADO' && (
                    <span className="ml-2 inline-block rounded bg-amber/15 px-1.5 py-[1px] font-display italic text-[0.62rem] font-semibold text-terra">
                      {r.coord}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2.5 py-2">
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase', BRAND_PILL[r.brand])}>
                  {BRAND_LABEL[r.brand]}
                </span>
              </td>
              <td className="px-2.5 py-2">
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase', TIER_PILL[r.tier])}>
                  {TIER_LABEL[r.tier]}
                </span>
              </td>
              {showAbc && (
                <td className="px-2.5 py-2">
                  <span className={cn('inline-flex h-6 min-w-[22px] items-center justify-center rounded-full font-display text-[0.7rem] font-extrabold text-paper', ABC_COLOR[r.abc])}>
                    {r.abc}
                  </span>
                </td>
              )}
              <td className="px-2.5 py-2 text-right num-tabular">{fmtNum(r.qty)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{r.customerCount}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(r.pm)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(r.value)}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{r.acum.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
