import {
  BRAND_LABEL,
  BRANDS,
  LINE_LABEL,
  fmtBRL,
  fmtPct,
  type Brand,
  type ProductLine,
} from '@painel/shared';
import { cn } from '@/lib/utils';

const BRAND_BAR_COLOR: Record<Brand, string> = {
  KIKI: 'bg-[#a08366]',
  MA: 'bg-[#8b6a8a]',
  VALENT: 'bg-sage',
};

const BRAND_TEXT_COLOR: Record<Brand, string> = {
  KIKI: 'text-[#a08366]',
  MA: 'text-[#8b6a8a]',
  VALENT: 'text-sage',
};

export function SssLinhaCards({
  data,
}: {
  data: Array<{
    line: ProductLine;
    v27: number;
    sss: number;
    customerCount: number;
    byBrand: Record<Brand, number>;
  }>;
}) {
  return (
    <div className="my-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {data.map((d) => {
        const total = BRANDS.reduce((s, b) => s + (d.byBrand[b] ?? 0), 0) || 1;
        const positive = d.sss >= 0;
        return (
          <div
            key={d.line}
            className={cn(
              'rounded-[10px] border p-4 text-center',
              positive ? 'border-sage/25 bg-sage/[0.04]' : 'border-rust/25 bg-rust/[0.04]',
            )}
          >
            <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.8px] text-ink-2">
              {LINE_LABEL[d.line]}
            </div>
            <div className={cn('font-display text-[1.6rem] font-bold', positive ? 'text-sage' : 'text-rust')}>
              {fmtPct(d.sss)}
            </div>
            <div className="mt-1 text-[0.72rem] text-ink-2 num-tabular">{fmtBRL(d.v27)}</div>
            <div className="mt-0.5 text-[0.6rem] text-ink-3">{d.customerCount} clientes</div>

            <div className="mt-2 flex h-1.5 gap-[2px] overflow-hidden rounded-[3px]">
              {BRANDS.map((b) => {
                const v = d.byBrand[b] ?? 0;
                if (v === 0) return null;
                return <div key={b} style={{ width: `${(v / total) * 100}%` }} className={BRAND_BAR_COLOR[b]} />;
              })}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-left text-[0.5rem] text-ink-3">
              {BRANDS.map((b) => {
                const v = d.byBrand[b] ?? 0;
                if (v === 0) return null;
                return (
                  <span key={b} className={BRAND_TEXT_COLOR[b]}>
                    ● {BRAND_LABEL[b]} {Math.round((v / total) * 100)}%
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
