import { fmtBRL, fmtPct } from '@painel/shared';

interface SssMacro {
  recurringCount: number;
  v26: number;
  v27: number;
  sssYoY: number;
  novos: { count: number; value: number };
  v27TotalCarteira: number;
  outliers: {
    count: number;
    v26: number;
    v27: number;
    sss: number;
    deltaShareOfYoy: number;
  } | null;
  normalized: {
    count: number;
    v26: number;
    v27: number;
    sss: number;
  } | null;
}

export function SssMacroBanner({ data }: { data: SssMacro }) {
  return (
    <>
      <div className="my-4 grid grid-cols-1 items-center gap-3.5 md:[grid-template-columns:1fr_50px_1fr_50px_1fr]">
        <div className="rounded-[14px] border border-amber/25 bg-gradient-to-br from-beige to-[#efe4c8] p-5 text-center">
          <div className="mb-2 font-display italic text-[0.78rem] font-medium text-ink-2">
            V26 · {data.recurringCount} cli recorrentes
          </div>
          <div className="font-display text-[1.7rem] font-semibold text-deep num-tabular">
            {fmtBRL(data.v26)}
          </div>
        </div>

        <div className="hidden text-center font-display text-[1.8rem] font-light text-terra/60 md:block">
          →
        </div>

        <div className="rounded-[14px] border border-amber/25 bg-gradient-to-br from-[#fde4c8] to-[#f9d0a0] p-5 text-center">
          <div className="mb-2 font-display italic text-[0.78rem] font-medium text-ink-2">
            V27 dos mesmos {data.recurringCount} cli
          </div>
          <div className="font-display text-[1.7rem] font-semibold text-deep num-tabular">
            {fmtBRL(data.v27)}
          </div>
        </div>

        <div className="hidden text-center font-display text-[1.8rem] font-light text-terra/60 md:block">
          =
        </div>

        <div className="rounded-[14px] border border-sage/30 bg-gradient-to-br from-[#e8f0e0] to-[#d4e4c8] p-5 text-center">
          <div className="mb-2 font-display italic text-[0.78rem] font-medium text-ink-2">
            SSS YoY
          </div>
          <div className="font-display text-[2.3rem] font-bold italic text-sage num-tabular">
            {fmtPct(data.sssYoY)}
          </div>
          <div className="mt-1.5 font-display italic text-[0.72rem] text-ink-2">
            + {fmtBRL(data.novos.value)} de {data.novos.count} NOVO 27
          </div>
          <div className="mt-1 font-display italic text-[0.72rem] text-ink-2 opacity-80">
            Carteira total V27: <b>{fmtBRL(data.v27TotalCarteira)}</b>
          </div>
        </div>
      </div>

      {data.outliers && data.normalized && (
        <div className="mt-4 rounded-[10px] border border-dashed border-amber/30 bg-gradient-to-r from-sage/[0.06] to-burnt/[0.06] px-5 py-4">
          <div className="mb-3 text-[0.85rem] tracking-wide text-ink-2">
            <b className="font-display text-[0.95rem] font-semibold text-deep">Análise normalizada</b>{' '}
            · excluindo {data.outliers.count} cliente
            {data.outliers.count > 1 ? 's' : ''} com crescimento &gt; +100% (outliers)
          </div>

          <div className="mb-3 grid gap-3.5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5 rounded-lg border border-amber/25 bg-paper px-4 py-3.5">
              <div className="text-[0.72rem] font-semibold uppercase tracking-wider text-ink-3">
                {data.normalized.count} cli normais
              </div>
              <div className="font-mono text-[0.78rem] text-ink-2">
                V26 {fmtBRL(data.normalized.v26)} → V27 {fmtBRL(data.normalized.v27)}
              </div>
              <div
                className={`font-display text-[1.4rem] font-semibold tracking-tight ${data.normalized.sss >= 0 ? 'text-sage' : 'text-rust'}`}
              >
                SSS {fmtPct(data.normalized.sss)}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-rust/25 bg-rust/5 px-4 py-3.5">
              <div className="text-[0.72rem] font-semibold uppercase tracking-wider text-ink-3">
                {data.outliers.count} outlier{data.outliers.count > 1 ? 's' : ''} (&gt;+100%)
              </div>
              <div className="font-mono text-[0.78rem] text-ink-2">
                V26 {fmtBRL(data.outliers.v26)} → V27 {fmtBRL(data.outliers.v27)}
              </div>
              <div className="font-display text-[1.4rem] font-semibold text-sage">
                +{Math.round(data.outliers.sss)}%
              </div>
            </div>
          </div>

          <div className="border-t border-black/5 pt-2 text-[0.78rem] italic text-ink-3">
            Os outliers contribuíram com{' '}
            <b className="not-italic text-deep">{fmtBRL(data.outliers.v27 - data.outliers.v26)}</b>{' '}
            de crescimento absoluto ·{' '}
            <b className="not-italic text-deep">{Math.round(data.outliers.deltaShareOfYoy)}%</b> do
            delta YoY total veio deles
          </div>
        </div>
      )}
    </>
  );
}
