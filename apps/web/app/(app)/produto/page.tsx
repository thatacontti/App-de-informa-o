'use client';

import { trpc } from '@/lib/trpc/client';
import { useFilter } from '@/lib/filter-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StratSummary } from '@/components/produto/strat-summary';
import { FaixaCards } from '@/components/produto/faixa-cards';
import { FaixaDetailTable } from '@/components/produto/faixa-detail-table';
import { FaixasGranular } from '@/components/produto/faixas-granular';
import { MixOptimization } from '@/components/produto/mix-optimization';
import { AbcCurve } from '@/components/produto/abc-curve';
import { Moodboard } from '@/components/produto/moodboard';
import { Coordenados } from '@/components/produto/coordenados';
import { RankTable } from '@/components/produto/rank-table';
import { InsightsTable } from '@/components/produto/insights-table';

function Section({
  title,
  children,
  subtitle,
  insight,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  subtitle?: string;
  insight?: { kind?: 'default' | 'success' | 'destructive'; html: React.ReactNode };
}) {
  return (
    <section className="mb-5 rounded-2xl border border-amber/15 bg-paper p-7 shadow-[0_4px_20px_-4px_rgba(139,74,82,0.08),0_1px_3px_rgba(139,74,82,0.04)]">
      <h2 className="mb-1 font-display text-[1.45rem] font-medium tracking-tight text-deep">
        <span className="mr-3 inline-block h-0.5 w-5 align-[6px] bg-amber" />
        {title}
      </h2>
      {subtitle && <p className="ml-9 mb-2 text-[0.84rem] text-ink-3">{subtitle}</p>}
      {insight && (
        <div className="my-3">
          <Alert variant={insight.kind === 'success' ? 'success' : insight.kind === 'destructive' ? 'destructive' : 'default'}>
            <AlertDescription>{insight.html}</AlertDescription>
          </Alert>
        </div>
      )}
      {children}
    </section>
  );
}

export default function ProdutoPage() {
  const { filter } = useFilter();
  const q = trpc.produto.dashboard.useQuery(filter);

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-[1500px] px-9 py-7">
        <div className="rounded-2xl border border-amber/15 bg-paper p-12 text-center text-sm italic text-ink-3">
          Carregando dashboard…
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
  const d = q.data;

  return (
    <div className="mx-auto max-w-[1500px] px-9 py-5">
      <Section
        title="Resumo para Desenvolvimento"
        subtitle="Diagnóstico automático do recorte selecionado. Muda conforme você filtra."
      >
        <StratSummary data={d.stratSummary} />
      </Section>

      <Section
        title="Performance por Faixa de Preço"
        insight={{
          html: (
            <>
              <b>Como comparar faixas com PMs diferentes — 3 indicadores normalizadores:</b>
              <br />
              • <b>Fat / SKU</b> = produtividade financeira (faturamento ÷ nº SKUs).
              <br />• <b>Peças / SKU</b> = giro físico.
              <br />• <b>Eficiência</b> = % Fat ÷ % Mix. &gt;1.2× = subexplorada · &lt;0.8× = canibalizada.
            </>
          ),
        }}
      >
        <FaixaCards data={d.faixaCards} />
        <div className="mt-3">
          <FaixaDetailTable data={d.faixaCards} />
        </div>
      </Section>

      <Section
        title="Performance por Faixa Granular de Preço (PM)"
        subtitle="Distribuição do mix em 14 faixas contínuas de ticket médio (PM por SKU) para análise fina de arquitetura de preço"
        insight={{
          html: (
            <>
              <b>Como ler:</b> cada linha é um intervalo de PM unitário. <b>Fat/SKU</b> mostra
              produtividade financeira por item · <b>Pç/SKU</b> mostra giro físico. Faixas com alto
              Fat/SKU e Pç/SKU são candidatas a ampliação no mix V28.
            </>
          ),
        }}
      >
        <FaixasGranular data={d.faixasGranular} />
      </Section>

      <Section
        title="Otimização de Mix · Tipo de Produto"
        insight={{
          kind: 'success',
          html: (
            <>
              <b>Recomendações automáticas na última coluna:</b> APROFUNDAR (ampliar grade/cores) ·
              MANTER · RACIONALIZAR (cortar na próxima coleção). Base para briefing do
              desenvolvimento V28.
            </>
          ),
        }}
      >
        <MixOptimization data={d.mixOptimization} />
      </Section>

      <Section title="Curva ABC">
        <AbcCurve data={d.abc} />
      </Section>

      <Section
        title="Moodboard · Top 30 SKUs"
        insight={{
          html: (
            <>
              <b>Cobertura</b> = % de clientes do recorte que pediram a peça (ex: 60% = 6 de cada 10
              lojas compraram). Verde ≥50% (transversal) · âmbar 25-50% · vermelho &lt;25%
              (concentrado em poucos clientes).
            </>
          ),
        }}
      >
        <Moodboard data={d.moodboard} />
      </Section>

      <Section title="Coordenados · Cartelas V27">
        <Coordenados data={d.coordenados} />
      </Section>

      <Section
        title={`Rank Geral Completo · ${d.kpis.skus} SKUs`}
        insight={{
          html: (
            <>
              <b>Todos os SKUs do recorte</b> ordenados por faturamento com classe ABC, faixa de
              preço e % acumulado.
            </>
          ),
        }}
      >
        <RankTable data={d.ranks.all} />
      </Section>

      <Section
        title={`Rank Curva B · ${d.ranks.b.length} SKUs · a serem desenvolvidos ou consolidados`}
        insight={{
          kind: 'success',
          html: (
            <>
              <b>SKUs da zona intermediária (80-95% do faturamento):</b> geralmente têm potencial
              para subir à Classe A ou consolidar posição. Candidatos naturais para aprofundar
              grade, variar cores ou ampliar divulgação no showroom.
            </>
          ),
        }}
      >
        <RankTable data={d.ranks.b} showAbc={false} />
      </Section>

      <Section
        title={`Rank Curva C · ${d.ranks.c.length} SKUs · candidatos a revisão ou exclusão em V28`}
        insight={{
          kind: 'destructive',
          html: (
            <>
              <b>SKUs da cauda longa (últimos 5% do faturamento):</b> candidatos a revisão para V28.
              Avaliar: baixa aceitação comercial, preço inadequado, timing de entrega, ou cobertura
              regional insuficiente.
            </>
          ),
        }}
      >
        <RankTable data={d.ranks.c} showAbc={false} />
      </Section>

      <Section title="Insights para Desenvolvimento">
        <h3 className="mb-2 font-display text-[1.05rem] italic font-medium text-terra">
          Aprofundar grade · alta cobertura, baixa profundidade
        </h3>
        <InsightsTable data={d.insights.aprofundar} />

        <h3 className="mt-6 mb-2 font-display text-[1.05rem] italic font-medium text-terra">
          Produtos com alto giro · destacar no showroom
        </h3>
        <InsightsTable data={d.insights.altoGiro} />
      </Section>
    </div>
  );
}
