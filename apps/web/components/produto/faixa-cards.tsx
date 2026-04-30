import { fmtBRL, fmtNum, type PriceTier } from '@painel/shared';
import { cn } from '@/lib/utils';

const TIER_GRADIENT: Record<PriceTier, string> = {
  ENTRADA: 'bg-gradient-to-br from-[#a08366] to-[#6b5340]',
  MEDIO: 'bg-gradient-to-br from-burnt to-terra',
  PREMIUM: 'bg-gradient-to-br from-[#5a2735] to-[#1a0f0a]',
};

const TIER_LABEL: Record<PriceTier, string> = {
  ENTRADA: 'ENTRADA',
  MEDIO: 'MÉDIO',
  PREMIUM: 'PREMIUM',
};

interface Faixa {
  tier: PriceTier;
  value: number;
  qty: number;
  skus: number;
  pmUnit: number;
  pctValue: number;
  pctSkus: number;
  fatPorSku: number;
  pecasPorSku: number;
  pecasEquiv: number;
  eficiencia: number;
}

export function FaixaCards({ data }: { data: Faixa[] }) {
  return (
    <div className="my-3 grid grid-cols-1 gap-3.5 md:grid-cols-3">
      {data.map((f) => (
        <div
          key={f.tier}
          className={cn(
            'relative overflow-hidden rounded-2xl p-5 text-paper shadow-[0_8px_32px_-8px_rgba(74,35,24,0.3)]',
            TIER_GRADIENT[f.tier],
          )}
        >
          <span className="absolute right-[-15%] top-[-30%] h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)]" />
          <div className="font-display italic text-[0.82rem] font-medium tracking-wider opacity-90">
            {TIER_LABEL[f.tier]}
          </div>
          <div className="font-display text-[2rem] font-bold leading-tight tracking-tight num-tabular">
            {fmtBRL(f.value)}
          </div>
          <div className="mb-3 mt-1 text-[0.82rem] font-light opacity-90">
            {f.pctValue.toFixed(1)}% do faturamento
          </div>
          <div className="h-[3px] overflow-hidden rounded-[2px] bg-white/20">
            <div className="h-full rounded-[2px] bg-paper transition-[width] duration-700" style={{ width: `${f.pctValue}%` }} />
          </div>

          <div className="mt-3.5 grid grid-cols-4 gap-1.5 text-center">
            {[
              { v: f.skus, l: `SKUs (${f.pctSkus.toFixed(0)}%)` },
              { v: fmtNum(f.qty), l: 'peças' },
              { v: '—', l: 'clientes' },
              { v: fmtBRL(f.pmUnit), l: 'PM unitário' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/[0.12] px-1 py-2 backdrop-blur-sm">
                <b className="block font-display text-[1rem] font-semibold">{typeof s.v === 'number' ? s.v : s.v}</b>
                <small className="mt-0.5 block text-[0.58rem] uppercase tracking-[0.5px] opacity-80">
                  {s.l}
                </small>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-1.5 border-t border-white/20 pt-2.5">
            {[
              { l: 'Fat médio por SKU', v: fmtBRL(f.fatPorSku) },
              { l: 'Peças vendidas por SKU', v: f.pecasPorSku.toFixed(1) },
              { l: 'Peças equivalentes (Fat÷PM)', v: fmtNum(f.pecasEquiv) },
            ].map((row, i) => (
              <div key={i} className="flex items-baseline justify-between text-[0.78rem] opacity-95">
                <span>{row.l}</span>
                <b className="font-display text-[0.95rem] font-bold">{row.v}</b>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
