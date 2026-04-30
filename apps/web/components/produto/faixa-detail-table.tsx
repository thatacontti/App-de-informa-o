import { fmtBRL, fmtNum, type PriceTier } from '@painel/shared';
import { cn } from '@/lib/utils';

const TIER_PILL: Record<PriceTier, string> = {
  ENTRADA: 'bg-[#a08366]',
  MEDIO: 'bg-burnt',
  PREMIUM: 'bg-deep',
};

const TIER_LABEL: Record<PriceTier, string> = {
  ENTRADA: 'ENTRADA',
  MEDIO: 'MÉDIO',
  PREMIUM: 'PREMIUM',
};

export function FaixaDetailTable({
  data,
}: {
  data: Array<{
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
  }>;
}) {
  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          {['Faixa', 'SKUs', '% Mix', 'Peças', 'PM unitário', 'Fat / SKU', 'Peças / SKU', 'Peças equiv', 'Faturamento', '% Total', 'Eficiência'].map((h, i) => (
            <th key={h} className={cn('px-2.5 py-2.5 font-display italic text-[0.72rem] tracking-wide text-terra', i >= 1 ? 'text-right' : 'text-left')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((d) => {
          const ec = d.eficiencia > 1.2 ? 'text-sage' : d.eficiencia < 0.8 ? 'text-rust' : 'text-[#b88a3a]';
          return (
            <tr key={d.tier} className="border-b border-amber/10 hover:bg-beige/30">
              <td className="px-2.5 py-2">
                <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-paper', TIER_PILL[d.tier])}>
                  {TIER_LABEL[d.tier]}
                </span>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{d.skus}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{d.pctSkus.toFixed(0)}%</td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtNum(d.qty)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(d.pmUnit)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(d.fatPorSku)}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{d.pecasPorSku.toFixed(1)}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtNum(d.pecasEquiv)}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(d.value)}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{d.pctValue.toFixed(1)}%</td>
              <td className={cn('px-2.5 py-2 text-right num-tabular font-bold', ec)}>
                {d.eficiencia.toFixed(2)}×
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
