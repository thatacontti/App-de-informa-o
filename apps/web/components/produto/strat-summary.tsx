import { BRAND_LABEL, fmtBRL, fmtNum, type Brand } from '@painel/shared';
import { cn } from '@/lib/utils';

interface Strat {
  faturamento: number;
  pecas: number;
  pm: number;
  skus: number;
  arquiteturaPreco: { ENTRADA: number; MEDIO: number; PREMIUM: number };
  abcStrong: number;
  abcASkus: number;
  topBrand: { brand: Brand; value: number; pct: number };
  premiumShare: number;
  coberturaCandidatos: number;
}

function ActionItem({
  kind,
  title,
  description,
}: {
  kind?: 'default' | 'ok' | 'alert';
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'mb-1.5 block rounded-[10px] border-l-[3px] px-3 py-2.5 transition-transform hover:translate-x-[2px]',
        kind === 'ok' && 'border-l-sage bg-sage/[0.07]',
        kind === 'alert' && 'border-l-rust bg-rust/[0.07]',
        (!kind || kind === 'default') && 'border-l-amber bg-beige/40',
      )}
    >
      <b className="mb-0.5 block text-[0.82rem] font-bold tracking-wide text-deep">{title}</b>
      <span className="text-[0.76rem] leading-snug text-ink-2">{description}</span>
    </div>
  );
}

export function StratSummary({ data }: { data: Strat }) {
  return (
    <div className="my-2 grid grid-cols-1 gap-4 lg:[grid-template-columns:1.3fr_1fr]">
      <div className="relative overflow-hidden rounded-2xl border border-amber/25 bg-gradient-to-br from-beige to-[#f5d9a8] p-7 shadow-[0_4px_16px_-4px_rgba(212,165,116,0.25)]">
        <div className="font-display text-[2.5rem] font-bold leading-none tracking-tight text-deep">
          {fmtBRL(data.faturamento)}
        </div>
        <div className="mt-2 mb-4 text-[0.9rem] leading-snug text-ink-2">
          faturamento V27 do recorte · <b className="text-terra">{data.skus} SKUs</b> ativos · PM{' '}
          <b className="text-terra">{fmtBRL(data.pm)}</b>
        </div>

        <div className="relative z-10 flex flex-col gap-2">
          {(['PREMIUM', 'MEDIO', 'ENTRADA'] as const).map((tier) => {
            const pct = data.arquiteturaPreco[tier];
            const fill =
              tier === 'PREMIUM' ? 'from-terra to-deep' : tier === 'MEDIO' ? 'from-burnt to-terra' : 'from-[#b89a7a] to-burnt';
            return (
              <div
                key={tier}
                className="grid items-center gap-2.5 [grid-template-columns:82px_1fr_50px]"
              >
                <span className="font-display italic text-[0.72rem] font-medium tracking-wide text-ink-2">
                  {tier === 'MEDIO' ? 'MÉDIO' : tier}
                </span>
                <div className="h-3 overflow-hidden rounded-full bg-deep/[0.08]">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700', fill)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-right font-display text-[0.92rem] font-bold text-deep">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-amber/15 bg-paper p-5 shadow-[0_4px_16px_-4px_rgba(139,74,82,0.08)]">
        <div className="mb-3 border-b border-amber/20 pb-2.5 font-display italic text-[0.88rem] font-semibold tracking-wide text-terra">
          DIREÇÃO ESTRATÉGICA
        </div>
        <ActionItem
          kind="ok"
          title="CONCENTRAÇÃO ABC"
          description={
            <>
              {data.abcASkus} SKUs Classe A ({((data.abcASkus / data.skus) * 100).toFixed(0)}% do
              mix) sustentam {data.abcStrong.toFixed(0)}% do faturamento. Priorizar reposição
              desses itens.
            </>
          }
        />
        <ActionItem
          kind={data.premiumShare < 25 ? 'alert' : data.arquiteturaPreco.PREMIUM > 40 ? 'ok' : 'default'}
          title="ARQUITETURA DE PREÇO"
          description={
            <>
              Premium = {data.arquiteturaPreco.PREMIUM.toFixed(0)}% do faturamento.{' '}
              {data.premiumShare < 25
                ? 'Ampliar linha premium.'
                : data.arquiteturaPreco.PREMIUM > 50
                  ? 'Reforçar entrada.'
                  : 'Balanceado.'}
            </>
          }
        />
        <ActionItem
          kind="ok"
          title={`MARCA LÍDER: ${BRAND_LABEL[data.topBrand.brand]}`}
          description={<>{data.topBrand.pct.toFixed(0)}% do faturamento do recorte.</>}
        />
        <ActionItem
          title="COBERTURA"
          description={
            <>
              {data.coberturaCandidatos} SKUs com alta cobertura e baixa profundidade — candidatos a
              aprofundar grade.
            </>
          }
        />
      </div>
    </div>
  );
}
