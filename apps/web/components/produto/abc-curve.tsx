import { fmtBRL } from '@painel/shared';
import { cn } from '@/lib/utils';

const COLOR: Record<string, string> = {
  A: 'bg-rust',
  B: 'bg-amber',
  C: 'bg-ink-3',
};

export function AbcCurve({
  data,
}: {
  data: Array<{ classe: 'A' | 'B' | 'C'; skus: number; value: number; pct: number }>;
}) {
  const totalValue = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex gap-2.5">
      {data.map((c) => (
        <div
          key={c.classe}
          className="min-w-[140px] flex-grow overflow-hidden rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
          style={{ flex: c.value || 1 }}
        >
          <div className={cn('px-3 py-2 font-bold text-paper', COLOR[c.classe])}>
            Classe {c.classe} · {c.pct.toFixed(1)}%
          </div>
          <div className="bg-paper px-3 py-2.5 text-[0.82rem]">
            <b className="text-terra">{c.skus} SKUs</b>
            <br />
            {fmtBRL(c.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
