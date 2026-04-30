import { BRAND_LABEL, fmtBRL, type Brand } from '@painel/shared';

const BRAND_COLOR: Record<Brand, string> = {
  KIKI: '#a08366',
  MA: '#8b6a8a',
  VALENT: '#4a8b5a',
};

export function MarcaShare({
  data,
  mode,
}: {
  data: Array<{ brand: Brand; value: number; pct: number }>;
  mode: 'DIRETORIA' | 'PRODUTO';
}) {
  return (
    <div className="my-4 flex flex-wrap justify-center gap-4">
      {data.map((d) => {
        const co = BRAND_COLOR[d.brand];
        return (
          <div
            key={d.brand}
            className="min-w-[180px] rounded-[10px] border bg-paper px-5 py-3 text-center"
            style={{ borderColor: `${co}40`, backgroundColor: `${co}08` }}
          >
            <div
              className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider"
              style={{ color: co }}
            >
              {BRAND_LABEL[d.brand]}
            </div>
            <div className="font-display text-2xl font-bold text-ink-1 num-tabular">
              {d.pct.toFixed(1)}%
            </div>
            <div className="mt-0.5 text-[0.72rem] text-ink-2 num-tabular">
              {mode === 'DIRETORIA' ? fmtBRL(d.value) : `${Math.round(d.value).toLocaleString('pt-BR')} pç`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
