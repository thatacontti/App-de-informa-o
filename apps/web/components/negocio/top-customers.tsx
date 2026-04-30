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

export function TopCustomersTable({
  data,
}: {
  data: Array<{
    id: string;
    name: string;
    cityName: string | null;
    ufId: string;
    profile: CustomerProfile;
    v26: number;
    v27: number;
    varPct: number | null;
  }>;
}) {
  return (
    <div className="max-h-[540px] overflow-auto rounded-[10px] border border-amber/15">
      <table className="w-full text-[0.82rem]">
        <thead className="sticky top-0 bg-beige/80 backdrop-blur">
          <tr className="border-b-2 border-amber/30">
            {['#', 'Cliente', 'Cidade', 'UF', 'Perfil', 'V26', 'V27', 'Var %'].map((h, i) => (
              <th
                key={h}
                className={cn(
                  'px-2.5 py-2.5 font-display italic text-[0.72rem] font-medium tracking-wide text-terra',
                  i >= 5 ? 'text-right' : 'text-left',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => {
            const cl =
              c.varPct === null
                ? 'text-[#3a6b9a]'
                : c.varPct > 20
                  ? 'text-sage'
                  : c.varPct < -20
                    ? 'text-rust'
                    : 'text-[#b88a3a]';
            return (
              <tr key={c.id} className="border-b border-amber/10 hover:bg-beige/30">
                <td className="px-2.5 py-2 text-[0.74rem] font-mono font-semibold text-ink-3">
                  #{i + 1}
                </td>
                <td className="px-2.5 py-2">
                  <b className="text-ink-1">{c.name.substring(0, 32)}</b>
                </td>
                <td className="px-2.5 py-2 text-ink-2">
                  {c.cityName ? c.cityName.substring(0, 16) : '—'}
                </td>
                <td className="px-2.5 py-2 text-ink-2">{c.ufId}</td>
                <td className="px-2.5 py-2">
                  <span
                    className={cn(
                      'inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider',
                      PROFILE_COLOR[c.profile],
                    )}
                  >
                    {CUSTOMER_PROFILE_LABEL[c.profile]}
                  </span>
                </td>
                <td className="px-2.5 py-2 text-right num-tabular">
                  {c.v26 ? fmtBRL(c.v26) : '—'}
                </td>
                <td className="px-2.5 py-2 text-right num-tabular">
                  <b>{fmtBRL(c.v27)}</b>
                </td>
                <td className={cn('px-2.5 py-2 text-right num-tabular font-bold', cl)}>
                  {c.varPct === null ? 'NOVO' : fmtPct(c.varPct, 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
