import { fmtBRL, fmtPct } from '@painel/shared';
import { cn } from '@/lib/utils';

export function UfYoyTable({
  data,
}: {
  data: Array<{
    ufId: string;
    v26: number;
    v27: number;
    delta: number;
    sss: number;
    cliCount: number;
    repPct: number;
  }>;
}) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-[0.82rem]">
        <thead>
          <tr className="border-b-2 border-amber/30 bg-beige/60">
            {['#', 'UF', 'Clientes rec.', 'V26', 'V27', 'Δ R$', 'SSS YoY', 'Repr. V27'].map(
              (h, i) => (
                <th
                  key={h}
                  className={cn(
                    'px-2.5 py-2.5 font-display italic text-[0.72rem] font-medium tracking-wide text-terra',
                    i >= 2 ? 'text-right' : 'text-left',
                  )}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const sssClass =
              r.sss >= 20
                ? 'text-sage'
                : r.sss >= 0
                  ? 'text-[#b88a3a]'
                  : r.sss >= -20
                    ? 'text-burnt'
                    : 'text-rust';
            return (
              <tr key={r.ufId} className="border-b border-amber/10 hover:bg-beige/30">
                <td className="px-2.5 py-2 font-mono text-[0.74rem] font-semibold text-ink-3">
                  #{i + 1}
                </td>
                <td className="px-2.5 py-2">
                  <b className="text-ink-1">{r.ufId}</b>
                </td>
                <td className="px-2.5 py-2 text-right num-tabular">{r.cliCount}</td>
                <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(r.v26)}</td>
                <td className="px-2.5 py-2 text-right num-tabular">
                  <b>{fmtBRL(r.v27)}</b>
                </td>
                <td
                  className={cn(
                    'px-2.5 py-2 text-right num-tabular font-bold',
                    r.delta >= 0 ? 'text-sage' : 'text-rust',
                  )}
                >
                  {r.delta >= 0 ? '+' : ''}
                  {fmtBRL(r.delta)}
                </td>
                <td className={cn('px-2.5 py-2 text-right num-tabular font-bold', sssClass)}>
                  {fmtPct(r.sss)}
                </td>
                <td className="px-2.5 py-2 text-right num-tabular">{r.repPct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
