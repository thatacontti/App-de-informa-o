import { BRAND_LABEL, fmtBRL, fmtNum, type Brand, type PriceTier } from '@painel/shared';
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
  ENTRADA: 'ENT',
  MEDIO: 'MÉD',
  PREMIUM: 'PRE',
};

interface Row {
  sku: string;
  name: string;
  brand: Brand;
  designer: string | null;
  tier: PriceTier;
  qty: number;
  customerCount: number;
  value: number;
}

export function InsightsTable({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-amber/15 bg-paper px-4 py-6 text-center font-display italic text-ink-3">
        —
      </div>
    );
  }

  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          {['SKU', 'Produto', 'Marca', 'Faixa', 'Pç', 'Cli', 'Fat'].map((h, i) => (
            <th
              key={h}
              className={cn(
                'px-2.5 py-2.5 font-display italic text-[0.72rem] tracking-wide text-terra',
                i >= 4 ? 'text-right' : 'text-left',
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((r) => (
          <tr key={r.sku} className="border-b border-amber/10 hover:bg-beige/30">
            <td className="px-2.5 py-2">
              <span className="font-mono text-[0.72rem] font-bold text-terra">{r.sku}</span>
              {r.designer && (
                <div className="text-[0.55rem] font-semibold text-[#8b6a8a]">{r.designer}</div>
              )}
            </td>
            <td className="px-2.5 py-2 text-ink-1">{r.name}</td>
            <td className="px-2.5 py-2">
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase', BRAND_PILL[r.brand])}>
                {BRAND_LABEL[r.brand].slice(0, 4)}
              </span>
            </td>
            <td className="px-2.5 py-2">
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase', TIER_PILL[r.tier])}>
                {TIER_LABEL[r.tier]}
              </span>
            </td>
            <td className="px-2.5 py-2 text-right num-tabular">{fmtNum(r.qty)}</td>
            <td className="px-2.5 py-2 text-right num-tabular">{r.customerCount}</td>
            <td className="px-2.5 py-2 text-right num-tabular">
              <b>{fmtBRL(r.value)}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
