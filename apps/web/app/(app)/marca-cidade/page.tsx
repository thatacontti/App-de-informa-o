'use client';

import { trpc } from '@/lib/trpc/client';
import { useFilter } from '@/lib/filter-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SssMarcaTable } from '@/components/marca-cidade/sss-marca';
import { SssMarcaLinhaMatrix } from '@/components/marca-cidade/sss-marca-linha';
import { SssLinhaCards } from '@/components/marca-cidade/sss-linha-cards';
import { CityProfileCards } from '@/components/marca-cidade/city-profile-cards';
import { CityIbgeTable } from '@/components/marca-cidade/city-ibge-table';
import { BrandByProfileMatrix } from '@/components/marca-cidade/brand-by-profile';
import { TopCitiesTable } from '@/components/marca-cidade/top-cities';

function Section({
  title,
  children,
  insight,
  subtitle,
}: {
  title: string;
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
        <div className="mb-3">
          <Alert variant={insight.kind === 'success' ? 'success' : insight.kind === 'destructive' ? 'destructive' : 'default'}>
            <AlertDescription>{insight.html}</AlertDescription>
          </Alert>
        </div>
      )}
      {children}
    </section>
  );
}

export default function MarcaCidadePage() {
  const { filter } = useFilter();
  const q = trpc.marcaCidade.dashboard.useQuery(filter);

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
          <AlertDescription>Erro ao carregar dashboard: {q.error?.message ?? 'sem dados'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { sssMarca, sssMarcaLinha, sssLinha, cityIbge, cityProfile, brandByProfile, topCities } = q.data;

  return (
    <div className="mx-auto max-w-[1500px] px-9 py-5">
      <Section
        title="🏷 SSS por Marca · V26 estimado vs V27"
        insight={{
          kind: 'success',
          html: (
            <>
              <b>Método EXATO:</b> V26 por marca = base oficial segmentada (verão_atualizado.xlsx).
              Match real cliente × marca × ano. Sem estimativa.
            </>
          ),
        }}
      >
        <SssMarcaTable data={sssMarca} />

        <h3 className="mt-6 mb-2 font-display text-[1.05rem] italic font-medium text-terra">
          SSS por Marca × Linha / Idade
        </h3>
        <Alert>
          <AlertDescription>
            <b>V26 não tem informação de linha.</b> O V26 é exato por marca (via base segmentada). A
            distribuição por linha mostra como o V27 de cada marca se distribui entre BEBE,
            Primeiros Passos, Infantil e Teen — para entender qual idade puxa o resultado.
          </AlertDescription>
        </Alert>
        <div className="mt-3">
          <SssMarcaLinhaMatrix data={sssMarcaLinha} />
        </div>

        <h3 className="mt-7 mb-2 font-display text-[1.05rem] italic font-medium text-terra">
          SSS por Linha / Idade
        </h3>
        <Alert>
          <AlertDescription>
            <b>Cada linha está positiva?</b> Cards mostram SSS estimado por linha (V26 distribuído
            proporcionalmente pelo peso da linha no V27 do mesmo cliente). Barra inferior mostra
            composição por marca dentro de cada linha.
          </AlertDescription>
        </Alert>
        <SssLinhaCards data={sssLinha} />
      </Section>

      <Section
        title="🌆 Performance por Perfil de Cidade"
        insight={{
          kind: 'success',
          html: (
            <>
              <b>Como funciona:</b> cada cidade classificada pelo perfil do cliente que mais fatura
              nela — agrupadas para entender onde a carteira é premium vs expansão.
            </>
          ),
        }}
      >
        <CityProfileCards data={cityProfile} />
      </Section>

      <Section
        title="Performance por Perfil de Cidade · Classificação IBGE"
        subtitle="Análise regional por porte populacional — metrópoles (>1M) · grandes (500k-1M) · médias (100-500k) · pequenas (20-100k) · micro (<20k)"
        insight={{
          html: (
            <>
              <b>Leitura:</b> V26 recorr. e V27 recorr. comparam apenas clientes recorrentes (mesma
              base). V27 total inclui NOVOS 27. SSS ≥+20% = tração forte; 0 a +20% = saudável; -20
              a 0% = atenção; abaixo = crítico.
            </>
          ),
        }}
      >
        <CityIbgeTable data={cityIbge} />
      </Section>

      <Section
        title="🔀 Matriz Marca × Perfil de Cidade"
        insight={{
          html: (
            <>
              <b>Estratégia:</b> KIKI forte em cidades VIP = consolidação; Valent em NOVO 27 =
              frente de expansão.
            </>
          ),
        }}
      >
        <BrandByProfileMatrix data={brandByProfile} />
      </Section>

      <Section title="🏙 Top 15 Cidades">
        <TopCitiesTable data={topCities} />
      </Section>
    </div>
  );
}
