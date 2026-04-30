import {
  CUSTOMER_PROFILE_LABEL,
  fmtBRL,
  fmtNum,
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

export function TopCitiesTable({
  data,
}: {
  data: Array<{
    cityId: string;
    cityName: string;
    ufId: string;
    v27: number;
    qty: number;
    customers: number;
    dominantProfile: CustomerProfile;
  }>;
}) {
  return (
    <div className="max-h-[540px] overflow-auto rounded-[10px] border border-amber/15">
      <table className="w-full text-[0.82rem]">
        <thead className="sticky top-0 bg-beige/80 backdrop-blur">
          <tr className="border-b-2 border-amber/30">
            {['#', 'Cidade', 'UF', 'Perfil dom.', 'Cli', 'Pç', 'Fat'].map((h, i) => (
              <th
                key={h}
                className={cn(
                  'px-2.5 py-2.5 font-display italic text-[0.72rem] tracking-wide text-terra',
                  i >= 4 ? 'text-right' : 'text-left',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={c.cityId} className="border-b border-amber/10 hover:bg-beige/30">
              <td className="px-2.5 py-2 font-mono text-[0.74rem] font-semibold text-ink-3">#{i + 1}</td>
              <td className="px-2.5 py-2">
                <b className="text-ink-1">{c.cityName}</b>
              </td>
              <td className="px-2.5 py-2 text-ink-2">{c.ufId}</td>
              <td className="px-2.5 py-2">
                <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider', PROFILE_COLOR[c.dominantProfile])}>
                  {CUSTOMER_PROFILE_LABEL[c.dominantProfile]}
                </span>
              </td>
              <td className="px-2.5 py-2 text-right num-tabular">{c.customers}</td>
              <td className="px-2.5 py-2 text-right num-tabular">{fmtNum(c.qty)}</td>
              <td className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(c.v27)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
