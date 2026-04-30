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

export function CityProfileCards({
  data,
}: {
  data: Array<{
    profile: CustomerProfile;
    cities: number;
    customers: number;
    qty: number;
    v27: number;
    pmUnit: number;
    pctOfTotal: number;
  }>;
}) {
  return (
    <div className="my-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
      {data.map((d) => (
        <div key={d.profile} className="rounded-[14px] border-t-[3px] border-amber bg-paper p-[18px] shadow-[0_3px_12px_-3px_rgba(139,74,82,0.08)] transition-transform hover:-translate-y-[3px]">
          <div className="mb-2">
            <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider', PROFILE_COLOR[d.profile])}>
              {CUSTOMER_PROFILE_LABEL[d.profile]}
            </span>
          </div>
          <div className="font-display text-[1.4rem] font-bold text-deep num-tabular">{fmtBRL(d.v27)}</div>
          <div className="mb-2 mt-1 text-[0.72rem] text-ink-3">
            {d.pctOfTotal.toFixed(1)}% do faturamento · PM {fmtBRL(d.pmUnit)}
          </div>
          <div className="mb-2 h-1 overflow-hidden rounded-[2px] bg-amber/15">
            <div className="h-full bg-gradient-to-r from-amber to-terra transition-[width] duration-700" style={{ width: `${d.pctOfTotal}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              { v: d.cities, l: 'cidades' },
              { v: d.customers, l: 'clientes' },
              { v: d.qty, l: 'peças' },
            ].map((s, i) => (
              <div key={i} className="rounded-md bg-beige/40 px-1 py-1.5">
                <b className="block font-display text-[0.95rem] font-semibold text-deep num-tabular">{fmtNum(s.v)}</b>
                <small className="block text-[0.58rem] uppercase tracking-[0.5px] text-ink-3">{s.l}</small>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
