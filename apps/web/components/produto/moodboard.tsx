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
  ENTRADA: 'ENTRADA',
  MEDIO: 'MÉDIO',
  PREMIUM: 'PREMIUM',
};

const ABC_COLOR: Record<string, string> = {
  A: 'bg-rust',
  B: 'bg-amber',
  C: 'bg-ink-3',
};

export function Moodboard({
  data,
}: {
  data: Array<{
    rank: number;
    sku: string;
    name: string;
    brand: Brand;
    tier: PriceTier;
    coord: string | null;
    designer: string | null;
    abc: 'A' | 'B' | 'C';
    qty: number;
    pcsPorCli: number;
    pm: number;
    value: number;
    cobertura: number;
    customerCount: number;
    totalCustomers: number;
  }>;
}) {
  return (
    <div className="grid gap-3.5 p-1.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
      {data.map((r, i) => {
        const cobCls = r.cobertura >= 50 ? 'text-sage' : r.cobertura >= 25 ? 'text-burnt' : 'text-rust';
        const cobBar = r.cobertura >= 50 ? 'from-sage to-[#4a8b5a]' : r.cobertura >= 25 ? 'from-amber to-burnt' : 'from-[#d4a08a] to-rust';
        return (
          <div
            key={r.sku}
            className="overflow-hidden rounded-xl border border-amber/15 bg-paper shadow-[0_3px_14px_-4px_rgba(139,74,82,0.15)] transition-transform hover:-translate-y-1"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-beige to-[#efe4c8]">
              <div className="flex h-full w-full items-center justify-center font-display text-[0.66rem] tracking-[3px] text-[#b8a080]/60">
                IMG · em breve
              </div>
              <div className="absolute left-2 top-2 rounded-full bg-deep/90 px-2.5 py-0.5 font-display text-[0.9rem] font-bold text-paper backdrop-blur-sm">
                {i + 1}
              </div>
              <div className={cn('absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full font-display text-[0.8rem] font-extrabold text-paper shadow-md', ABC_COLOR[r.abc])}>
                {r.abc}
              </div>
            </div>

            <div className="p-3.5">
              <div className="font-mono text-[0.68rem] font-bold tracking-tight text-terra">{r.sku}</div>
              {r.designer && (
                <div className="text-[0.6rem] font-semibold text-[#8b6a8a]">{r.designer}</div>
              )}
              <div className="mt-0.5 font-display text-[0.92rem] font-semibold leading-tight text-deep">
                {r.name}
              </div>
              {r.coord && r.coord !== 'SEM COORDENADO' && (
                <div className="font-display italic text-[0.72rem] text-burnt">{r.coord}</div>
              )}

              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className={cn('rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase', BRAND_PILL[r.brand])}>
                  {BRAND_LABEL[r.brand]}
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase', TIER_PILL[r.tier])}>
                  {TIER_LABEL[r.tier]}
                </span>
              </div>

              <div className="mt-2 rounded-lg border border-amber/20 bg-beige/40 px-2.5 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-display italic text-[0.7rem] text-terra">Cobertura</span>
                  <span className={cn('font-display text-[1.05rem] font-bold', cobCls)}>
                    {r.cobertura.toFixed(0)}%
                  </span>
                </div>
                <div className="my-1 h-1 overflow-hidden rounded-[3px] bg-deep/10">
                  <div className={cn('h-full rounded-[3px] bg-gradient-to-r transition-[width]', cobBar)} style={{ width: `${Math.min(r.cobertura, 100)}%` }} />
                </div>
                <div className="text-right font-mono text-[0.6rem] text-ink-3">
                  {r.customerCount} de {r.totalCustomers} clientes
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 border-y border-amber/15 py-2">
                {[
                  { l: 'Pç', v: fmtNum(r.qty) },
                  { l: 'Pç/Cli', v: r.pcsPorCli.toFixed(1) },
                  { l: 'PM', v: fmtBRL(r.pm) },
                ].map((s, j) => (
                  <div key={j} className="flex flex-col gap-0">
                    <span className="font-display italic text-[0.58rem] text-ink-3">{s.l}</span>
                    <b className="font-display text-[0.78rem] text-ink-1">{s.v}</b>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-center font-display text-[1.1rem] font-bold tracking-tight text-deep num-tabular">
                {fmtBRL(r.value)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
