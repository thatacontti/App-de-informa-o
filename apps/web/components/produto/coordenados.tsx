import { fmtBRL, fmtNum } from '@painel/shared';

export function Coordenados({
  data,
}: {
  data: Array<{ coord: string; value: number; qty: number; skus: number; customers: number }>;
}) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
      {data.map((c) => (
        <div key={c.coord} className="rounded-[10px] border-l-[3px] border-l-amber bg-gradient-to-br from-[rgba(254,246,232,0.8)] to-[rgba(253,240,217,0.8)] px-4 py-3 transition-transform hover:-translate-y-0.5">
          <div className="mb-1 font-display italic text-[0.92rem] font-semibold text-terra">
            ◆ {c.coord}
          </div>
          <div className="text-[0.74rem] text-ink-2">
            <b className="font-display text-ink-1">{fmtBRL(c.value)}</b> · {fmtNum(c.qty)}pç ·{' '}
            {c.skus} SKU · {c.customers}cli
          </div>
        </div>
      ))}
    </div>
  );
}
