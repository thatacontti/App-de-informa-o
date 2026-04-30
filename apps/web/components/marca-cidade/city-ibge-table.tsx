import { IBGE_TIER_LABEL, fmtBRL, fmtPct, type IbgePopulationTier } from '@painel/shared';
import { cn } from '@/lib/utils';

export function CityIbgeTable({
  data,
}: {
  data: Array<{
    tier: IbgePopulationTier;
    cities: number;
    customers: number;
    v26: number;
    v27Total: number;
    v27Recurring: number;
    sss: number;
    repPct: number;
  }>;
}) {
  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          {['Perfil IBGE', 'Cidades', 'Clientes', 'V26 recorr.', 'V27 total', 'V27 recorr.', 'SSS YoY', 'Rep V27'].map((h, i) => (
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
        {data.map((r) => {
          const sssCl =
            r.sss >= 20
              ? 'text-sage'
              : r.sss >= 0
                ? 'text-[#b88a3a]'
                : r.sss >= -20
                  ? 'text-burnt'
                  : 'text-rust';
          return (
            <tr key={r.tier} className="border-b border-amber/10 hover:bg-beige/30">
              <td className="px-2.5 py-2">
                <b className="text-ink-1">{IBGE_TIER_LABEL[r.tier]}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{r.cities}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{r.customers}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(r.v26)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(r.v27Total)}</b>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(r.v27Recurring)}</td>
              <td className={cn('px-2.5 py-2 text-right num-tabular font-bold', sssCl)}>{fmtPct(r.sss)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{r.repPct.toFixed(1)}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
