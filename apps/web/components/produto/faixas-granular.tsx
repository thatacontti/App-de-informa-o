import { fmtBRL, fmtNum } from '@painel/shared';
import { cn } from '@/lib/utils';

export function FaixasGranular({
  data,
}: {
  data: Array<{
    label: string;
    skus: number;
    pctSkus: number;
    qty: number;
    pctQty: number;
    value: number;
    pctValue: number;
    fatPorSku: number;
    pecasPorSku: number;
  }>;
}) {
  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          {['Faixa PM', 'SKUs', '% SKUs', 'Peças', '% Qtd', 'Fat/SKU', 'Pç/SKU', 'Faturamento', '% Fat'].map((h, i) => (
            <th
              key={h}
              className={cn(
                'px-2.5 py-2.5 font-display italic text-[0.72rem] tracking-wide text-terra',
                i >= 1 ? 'text-right' : 'text-left',
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((b) => (
          <tr key={b.label} className="border-b border-amber/10 hover:bg-beige/30">
            <td className="px-2.5 py-2">
              <b>R$ {b.label}</b>
            </td>
            <td className="px-2.5 py-2 text-right num-tabular">{b.skus}</td>
            <td className="px-2.5 py-2 text-right num-tabular">{b.pctSkus.toFixed(1)}%</td>
            <td className="px-2.5 py-2 text-right num-tabular">{fmtNum(b.qty)}</td>
            <td className="px-2.5 py-2 text-right num-tabular">{b.pctQty.toFixed(1)}%</td>
            <td className="px-2.5 py-2 text-right num-tabular">
              <b>{fmtBRL(b.fatPorSku)}</b>
            </td>
            <td className="px-2.5 py-2 text-right num-tabular">
              <b>{b.pecasPorSku.toFixed(1)}</b>
            </td>
            <td className="px-2.5 py-2 text-right num-tabular">
              <b>{fmtBRL(b.value)}</b>
            </td>
            <td className="px-2.5 py-2 text-right num-tabular">{b.pctValue.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
