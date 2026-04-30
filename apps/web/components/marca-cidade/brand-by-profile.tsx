import {
  BRAND_LABEL,
  CUSTOMER_PROFILE_LABEL,
  fmtBRL,
  type Brand,
  type CustomerProfile,
} from '@painel/shared';
import { cn } from '@/lib/utils';

const BRAND_PILL: Record<Brand, string> = {
  KIKI: 'bg-[#fddcc8] text-terra',
  MA: 'bg-[#eadcc5] text-ink-2',
  VALENT: 'bg-[#d8c5a8] text-deep',
};

export function BrandByProfileMatrix({
  data,
}: {
  data: {
    profiles: CustomerProfile[];
    rows: Array<{ brand: Brand; cells: number[]; total: number }>;
    columnTotals: number[];
    grandTotal: number;
  };
}) {
  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          <th className="px-2.5 py-2.5 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Marca</th>
          {data.profiles.map((p) => (
            <th key={p} className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">
              {CUSTOMER_PROFILE_LABEL[p]}
            </th>
          ))}
          <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">Total</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) => (
          <tr key={row.brand} className="border-b border-amber/10 hover:bg-beige/30">
            <td className="px-2.5 py-2">
              <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider', BRAND_PILL[row.brand])}>
                {BRAND_LABEL[row.brand]}
              </span>
            </td>
            {row.cells.map((v, i) => (
              <td key={i} className="px-2.5 py-2 text-right num-tabular">
                {v > 0 ? fmtBRL(v) : '—'}
              </td>
            ))}
            <td className="px-2.5 py-2 text-right num-tabular">
              <b>{fmtBRL(row.total)}</b>
            </td>
          </tr>
        ))}
        <tr className="bg-beige/70 font-bold">
          <td className="px-2.5 py-2">TOTAL</td>
          {data.columnTotals.map((v, i) => (
            <td key={i} className="px-2.5 py-2 text-right num-tabular">
              <b>{fmtBRL(v)}</b>
            </td>
          ))}
          <td className="px-2.5 py-2 text-right num-tabular">
            <b>{fmtBRL(data.grandTotal)}</b>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
