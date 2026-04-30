import {
  BRAND_LABEL,
  LINE_LABEL,
  fmtBRL,
  fmtPct,
  type Brand,
  type ProductLine,
} from '@painel/shared';
import { cn } from '@/lib/utils';

const BRAND_PILL: Record<Brand, string> = {
  KIKI: 'bg-[#fddcc8] text-terra',
  MA: 'bg-[#eadcc5] text-ink-2',
  VALENT: 'bg-[#d8c5a8] text-deep',
};

const LINE_ORDER: ProductLine[] = ['BEBE', 'PRIMEIROS_PASSOS', 'INFANTIL', 'TEEN'];

export function SssMarcaLinhaMatrix({
  data,
}: {
  data: Array<{
    brand: Brand;
    v26: number;
    v27: number;
    sss: number;
    lines: Array<{ line: ProductLine; value: number; pctOfBrand: number }>;
  }>;
}) {
  const totalV26 = data.reduce((s, d) => s + d.v26, 0);
  const totalV27 = data.reduce((s, d) => s + d.v27, 0);
  const totalSss = totalV26 ? ((totalV27 - totalV26) / totalV26) * 100 : 0;
  const lineTotals = LINE_ORDER.map((l) =>
    data.reduce((s, d) => s + (d.lines.find((x) => x.line === l)?.value ?? 0), 0),
  );

  return (
    <table className="w-full text-[0.82rem]">
      <thead>
        <tr className="border-b-2 border-amber/30 bg-beige/60">
          <th className="px-2.5 py-2.5 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Marca</th>
          <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">V26</th>
          <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">V27 total</th>
          <th className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">SSS YoY</th>
          {LINE_ORDER.map((l) => (
            <th key={l} className="px-2.5 py-2.5 text-right font-display italic text-[0.72rem] tracking-wide text-terra">
              {LINE_LABEL[l]}
            </th>
          ))}
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
            <td className={cn('px-2.5 py-2 text-right num-tabular font-bold', d.sss >= 0 ? 'text-sage' : 'text-rust')}>
              {fmtPct(d.sss)}
            </td>
            {LINE_ORDER.map((l) => {
              const cell = d.lines.find((x) => x.line === l);
              const v = cell?.value ?? 0;
              const pct = cell?.pctOfBrand ?? 0;
              return (
                <td key={l} className="px-2.5 py-2 text-right num-tabular">
                  {v > 0 ? (
                    <>
                      {fmtBRL(v)}
                      <br />
                      <span className="text-[0.6rem] text-ink-3">{Math.round(pct)}%</span>
                    </>
                  ) : (
                    <span className="text-[0.6rem] text-amber/80">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
        <tr className="bg-beige/70 font-semibold">
          <td className="px-2.5 py-2">TOTAL</td>
          <td className="px-2.5 py-2 text-right num-tabular">{fmtBRL(totalV26)}</td>
          <td className="px-2.5 py-2 text-right num-tabular">
            <b>{fmtBRL(totalV27)}</b>
          </td>
          <td className={cn('px-2.5 py-2 text-right num-tabular font-bold', totalSss >= 0 ? 'text-sage' : 'text-rust')}>
            {fmtPct(totalSss)}
          </td>
          {LINE_ORDER.map((l, i) => {
            const v = lineTotals[i] ?? 0;
            const pct = totalV27 ? (v / totalV27) * 100 : 0;
            return (
              <td key={l} className="px-2.5 py-2 text-right num-tabular">
                <b>{fmtBRL(v)}</b>
                <br />
                <span className="text-[0.6rem] text-ink-3">{Math.round(pct)}%</span>
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}
