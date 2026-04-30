import { BRAND_LABEL, fmtBRL, fmtPct, type Brand } from '@painel/shared';
import { cn } from '@/lib/utils';

const BRAND_PILL: Record<Brand, string> = {
  KIKI: 'bg-[#fddcc8] text-terra',
  MA: 'bg-[#eadcc5] text-ink-2',
  VALENT: 'bg-[#d8c5a8] text-deep',
};

export function SssMarcaTable({
  data,
}: {
  data: Array<{ brand: Brand; v26: number; v27: number; varPct: number }>;
}) {
  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          <th className="px-2.5 py-2.5 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Marca</th>
          <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">V26 real</th>
          <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">V27 dos recorrentes</th>
          <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">Var %</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.brand} className="border-b border-amber/10 hover:bg-beige/30">
            <td className="px-2.5 py-2">
              <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider', BRAND_PILL[d.brand])}>
                {BRAND_LABEL[d.brand]}
              </span>
            </td>
            <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(d.v26)}</td>
            <td className="px-2.5 py-2 text-right num-tabular">
              <b>{fmtBRL(d.v27)}</b>
            </td>
            <td className={cn('px-2.5 py-2 text-right num-tabular font-bold', d.varPct >= 0 ? 'text-sage' : 'text-rust')}>
              {fmtPct(d.varPct)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
