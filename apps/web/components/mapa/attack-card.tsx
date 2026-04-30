import type { PriceTier } from '@painel/shared';
import { cn } from '@/lib/utils';

const TIER_BG: Record<PriceTier, string> = {
  ENTRADA: 'bg-sage',
  MEDIO: 'bg-[#a08366]',
  PREMIUM: 'bg-[#8b4a6b]',
};

const TIER_LABEL: Record<PriceTier, string> = {
  ENTRADA: 'ENT',
  MEDIO: 'MÉD',
  PREMIUM: 'PRE',
};

interface Card {
  sku: string;
  name: string;
  pm: number;
  tier: PriceTier;
  designer: string | null;
}

export function AttackCard({ card }: { card: Card }) {
  return (
    <div
      className="w-[120px] flex-shrink-0 overflow-hidden rounded-lg border border-amber/15 bg-[#fafaf8] transition-transform hover:-translate-y-1 hover:shadow-[0_6px_18px_rgba(0,0,0,0.1)]"
      title={`${card.sku} · ${card.name}${card.designer ? ' · ' + card.designer : ''}`}
    >
      <div className="relative h-[160px] w-[120px] overflow-hidden bg-[#f5f0eb]">
        <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(135deg,#ede8e3_0,#ede8e3_8px,#e8e3dd_8px,#e8e3dd_16px)] font-display italic text-[0.55rem] tracking-[2px] text-ink-3/60">
          IMG
        </div>
        <span className={cn('absolute right-1 top-1 rounded-[3px] px-1.5 py-[1px] text-[0.56rem] font-bold uppercase tracking-[0.5px] text-paper', TIER_BG[card.tier])}>
          {TIER_LABEL[card.tier]}
        </span>
      </div>
      <div className="px-2 py-1 text-center">
        <div className="font-display text-[0.95rem] font-bold text-ink-1 num-tabular">
          R$ {Math.round(card.pm)}
        </div>
        <div className="font-mono text-[0.6rem] tracking-tight text-ink-3">{card.sku}</div>
        {card.designer && (
          <div className="text-[0.55rem] font-semibold text-[#8b6a8a]">{card.designer}</div>
        )}
      </div>
    </div>
  );
}
