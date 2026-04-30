import { fmtBRL, fmtNum } from '@painel/shared';
import { cn } from '@/lib/utils';

export function MixOptimization({
  data,
}: {
  data: Array<{
    group: string;
    skus: number;
    pctSkus: number;
    qty: number;
    customers: number;
    pm: number;
    value: number;
    pctValue: number;
    eficiencia: number;
    recommendation: string;
  }>;
}) {
  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          {['Tipo de Produto', 'SKUs', '% Mix', 'Peças', 'Cli', 'PM', 'Faturamento', '% Fat', 'Eficiência', 'Recomendação'].map((h, i) => (
            <th
              key={h}
              className={cn(
                'px-2.5 py-2.5 font-display italic text-[0.72rem] tracking-wide text-terra',
                i >= 1 && i !== 9 ? 'text-right' : 'text-left',
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((g) => {
          const efCl = g.eficiencia > 1.3 ? 'text-sage' : g.eficiencia < 0.7 ? 'text-rust' : 'text-[#b88a3a]';
          const recCl =
            g.recommendation === 'APROFUNDAR'
              ? 'bg-sage'
              : g.recommendation === 'RACIONALIZAR'
                ? 'bg-rust'
                : 'bg-ink-3';
          const efWidth = Math.min(g.eficiencia * 50, 100);
          const efBarColor = g.eficiencia > 1.3 ? 'bg-sage' : g.eficiencia < 0.7 ? 'bg-rust' : 'bg-[#b88a3a]';
          return (
            <tr key={g.group} className="border-b border-amber/10 hover:bg-beige/30">
              <td className="px-2.5 py-2">
                <b className="text-ink-1">{g.group}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{g.skus}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{g.pctSkus.toFixed(0)}%</td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtNum(g.qty)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{g.customers}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(g.pm)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(g.value)}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{g.pctValue.toFixed(1)}%</td>
              <td className={cn('px-2.5 py-2 text-right font-bold', efCl)}>
                <div className="flex items-center justify-end gap-1.5">
                  <div className="h-1.5 w-[60px] overflow-hidden rounded-[3px] bg-beige">
                    <div className={cn('h-full', efBarColor)} style={{ width: `${efWidth}%` }} />
                  </div>
                  <b className="num-tabular">{g.eficiencia.toFixed(2)}×</b>
                </div>
              </td>
              <td className="px-2.5 py-2">
                <span className={cn('inline-block rounded-full px-3 py-0.5 text-[0.64rem] font-bold uppercase tracking-wider text-paper', recCl)}>
                  {g.recommendation}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
