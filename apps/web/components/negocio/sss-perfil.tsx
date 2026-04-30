import {
  CUSTOMER_PROFILE_LABEL,
  fmtBRL,
  fmtPct,
  type CustomerProfile,
} from '@painel/shared';
import { cn } from '@/lib/utils';

const PROFILE_COLOR: Record<CustomerProfile, string> = {
  VIP_3PLUS: 'bg-deep text-paper',
  VIP: 'bg-terra text-paper',
  FREQUENTE: 'bg-burnt text-paper',
  REGULAR: 'bg-[#a08366] text-paper',
  NOVO_25: 'bg-[#3a6b9a]/80 text-paper',
  NOVO_27: 'bg-[#3a6b9a] text-paper',
};

export function SssPerfilTable({
  data,
}: {
  data: Array<{
    profile: CustomerProfile;
    count: number;
    v26: number;
    v27: number;
    varPct: number | null;
    avgTicket: number;
  }>;
}) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-[0.82rem]">
        <thead>
          <tr className="border-b-2 border-amber/30 bg-beige/60">
            <th className="px-2.5 py-2.5 text-left font-display italic text-[0.72rem] font-medium tracking-wide text-terra">
              Perfil
            </th>
            <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] font-medium tracking-wide text-terra">
              Cli
            </th>
            <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] font-medium tracking-wide text-terra">
              V26
            </th>
            <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] font-medium tracking-wide text-terra">
              V27
            </th>
            <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] font-medium tracking-wide text-terra">
              Var %
            </th>
            <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] font-medium tracking-wide text-terra">
              Tk médio V27
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.profile} className="border-b border-amber/10 hover:bg-beige/30">
              <td className="px-2.5 py-2">
                <span
                  className={cn(
                    'inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider',
                    PROFILE_COLOR[p.profile],
                  )}
                >
                  {CUSTOMER_PROFILE_LABEL[p.profile]}
                </span>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{p.count}</td>
              <td className="px-2.5 py-2 text-right num-tabular">
                {p.v26 ? fmtBRL(p.v26) : '—'}
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(p.v27)}</b>
              </td>
              <td
                className={cn(
                  'px-2.5 py-2 text-right num-tabular font-bold',
                  p.varPct === null
                    ? 'text-[#3a6b9a]'
                    : p.varPct > 0
                      ? 'text-sage'
                      : p.varPct < 0
                        ? 'text-rust'
                        : 'text-[#b88a3a]',
                )}
              >
                {p.varPct === null ? 'NOVO' : fmtPct(p.varPct, 0)}
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(p.avgTicket)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
