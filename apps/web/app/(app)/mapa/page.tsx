'use client';

import { fmtBRL, fmtNum } from '@painel/shared';
import { trpc } from '@/lib/trpc/client';
import { useFilter } from '@/lib/filter-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AttackMap1 } from '@/components/mapa/attack-map-1';
import { AttackMap2 } from '@/components/mapa/attack-map-2';

export default function MapaPage() {
  const { filter } = useFilter();
  const q = trpc.mapa.dashboard.useQuery(filter);

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-[1500px] px-9 py-7">
        <div className="rounded-2xl border border-amber/15 bg-paper p-12 text-center text-sm italic text-ink-3">
          Carregando mapa…
        </div>
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="mx-auto max-w-[1500px] px-9 py-7">
        <Alert variant="destructive">
          <AlertDescription>Erro: {q.error?.message ?? 'sem dados'}</AlertDescription>
        </Alert>
      </div>
    );
  }
  const { kpis, faixas, map1, map2 } = q.data;

  return (
    <div className="mx-auto max-w-[1500px] px-9 py-5">
      <section className="mb-5 rounded-2xl border border-amber/15 bg-paper p-7 shadow-[0_4px_20px_-4px_rgba(139,74,82,0.08),0_1px_3px_rgba(139,74,82,0.04)]">
        <h2 className="mb-1 font-display text-[1.45rem] font-medium tracking-tight text-deep">
          <span className="mr-3 inline-block h-0.5 w-5 align-[6px] bg-amber" />
          Mapa de Ataque · Visão Completa da Coleção V27
        </h2>
        <p className="ml-9 mb-3 text-[0.84rem] text-ink-3">
          Todos os SKUs agrupados por <b>Marca → Linha/Idade → Tipo de Produto</b>, com PM e faixa.
          Visão editorial para decisão de mix e vitrine.
        </p>

        <div className="mb-6 flex flex-wrap justify-center gap-6 border-b border-amber/20 pb-4 pt-1">
          {[
            { v: fmtNum(kpis.totalSkus), l: 'SKUs' },
            { v: fmtNum(kpis.totalQty), l: 'Peças' },
            { v: fmtBRL(kpis.totalValue), l: 'Faturamento' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <b className="block font-display text-[1.6rem] font-bold text-ink-1 num-tabular">{s.v}</b>
              <small className="text-[0.72rem] uppercase tracking-[0.8px] text-ink-3">{s.l}</small>
            </div>
          ))}
        </div>

        <h3 className="mb-1.5 font-display text-[1.1rem] font-semibold text-ink-1">
          Mapa de Preço por Tamanho e Marca
        </h3>
        <p className="mb-4 text-[0.78rem] text-ink-3">Marca × Linha/Idade · preço crescente</p>

        <AttackMap1 data={map1} faixas={faixas} />
      </section>

      <section className="mb-5 rounded-2xl border border-amber/15 bg-paper p-7 shadow-[0_4px_20px_-4px_rgba(139,74,82,0.08),0_1px_3px_rgba(139,74,82,0.04)]">
        <h2 className="mb-1 font-display text-[1.3rem] font-medium tracking-tight text-deep">
          Mapa de Ataque por Tipo de Produto
        </h2>
        <p className="ml-0 mb-4 text-[0.78rem] text-ink-3">Tipo × Faixa por Marca e Linha</p>

        <AttackMap2 data={map2} faixas={faixas} />
      </section>
    </div>
  );
}
