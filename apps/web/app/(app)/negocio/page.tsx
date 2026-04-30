'use client';

import { trpc } from '@/lib/trpc/client';
import { useFilter } from '@/lib/filter-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KpiCards } from '@/components/negocio/kpi-cards';
import { MarcaShare } from '@/components/negocio/marca-share';
import { SssMacroBanner } from '@/components/negocio/sss-macro';
import { SssPerfilTable } from '@/components/negocio/sss-perfil';
import { TopCustomersTable } from '@/components/negocio/top-customers';
import { UfYoyTable } from '@/components/negocio/uf-yoy';

function Section({
  title,
  children,
  insight,
}: {
  title: string;
  children: React.ReactNode;
  insight?: { kind?: 'default' | 'success' | 'destructive'; html: React.ReactNode };
}) {
  return (
    <section className="mb-5 rounded-2xl border border-amber/15 bg-paper p-7 shadow-[0_4px_20px_-4px_rgba(139,74,82,0.08),0_1px_3px_rgba(139,74,82,0.04)]">
      <h2 className="mb-2 font-display text-[1.45rem] font-medium tracking-tight text-deep">
        <span className="mr-3 inline-block h-0.5 w-5 align-[6px] bg-amber" />
        {title}
      </h2>
      {children}
      {insight && (
        <div className="mt-3">
          <Alert variant={insight.kind === 'success' ? 'success' : insight.kind === 'destructive' ? 'destructive' : 'default'}>
            <AlertDescription>{insight.html}</AlertDescription>
          </Alert>
        </div>
      )}
    </section>
  );
}

export default function NegocioPage() {
  const { filter, viewMode } = useFilter();
  const q = trpc.negocio.dashboard.useQuery(filter);

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

  const { kpis, marcaShare, sssMacro, sssByPerfil, topCustomers, ufYoY } = q.data;

  return (
    <div className="mx-auto max-w-[1500px] px-9 py-5">
      <KpiCards data={kpis} />

      <Section title="🏷 Participação por Marca">
        <MarcaShare data={marcaShare} mode={viewMode} />
      </Section>

      <Section
        title="💰 Same Store Sales · V26 ↔ V27"
        insight={{
          kind: 'success',
          html: (
            <>
              <b>Como ler:</b> V26 é o histórico dos clientes recorrentes. SSS = crescimento{' '}
              <b>real</b> dessa carteira. NOVO 27 soma à parte como conquistas líquidas.
            </>
          ),
        }}
      >
        <SssMacroBanner data={sssMacro} />
      </Section>

      <Section title="👥 Perfil de Cliente · oficial">
        <SssPerfilTable data={sssByPerfil} />
      </Section>

      <Section title="🏆 Top 20 Clientes · variação YoY">
        <TopCustomersTable data={topCustomers} />
      </Section>

      <Section
        title="🌎 Performance por Estado · V26 vs V27"
        insight={{
          html: (
            <>
              <b>Leitura:</b> SSS ≥ +20% = excepcional · 0 a +20% = saudável · -20 a 0% = atenção ·
              abaixo de -20% = crítico. Repr. V27 mostra quanto o estado representa do faturamento
              total.
            </>
          ),
        }}
      >
        <UfYoyTable data={ufYoY} />
      </Section>
    </div>
  );
}
