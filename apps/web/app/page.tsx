export default function HomePage() {
  return (
    <main className="relative">
      <section className="bg-hero-gradient px-12 py-12 text-paper">
        <div className="mx-auto max-w-[1500px]">
          <span className="mb-4 inline-block rounded-sm border border-amber/30 bg-amber/20 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[3px] text-amber">
            Painel V27 · Scaffold em construção
          </span>
          <h1 className="font-display text-5xl font-light leading-none tracking-tight">
            Verão <b className="font-extrabold italic text-amber">2027</b> · Grupo Catarina
          </h1>
          <p className="mt-3 max-w-[720px] text-[0.92rem] font-light leading-relaxed opacity-90">
            Etapa 1 (scaffold) concluída. Próxima etapa: autenticação e matriz de permissões.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-9 py-7">
        <div className="rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
          <h2 className="font-display text-2xl font-medium text-deep">
            Status de implementação
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-2">
            <li>✅ Etapa 1 — Scaffold (monorepo, Next.js, Tailwind, paleta, Docker)</li>
            <li>⏳ Etapa 2 — Auth + matriz de permissões</li>
            <li>⏳ Etapa 3 — Schema Prisma + seed de domínio</li>
            <li>⏳ Etapa 4 — Conectores (ERP · CRM · SharePoint)</li>
            <li>⏳ Etapa 5 — Jobs de sync (BullMQ)</li>
            <li>⏳ Etapa 6 a 9 — UI das 4 abas</li>
            <li>⏳ Etapa 10 — Briefing PDF + e-mail + Slack</li>
            <li>⏳ Etapa 11 — Notificações de alerta</li>
            <li>⏳ Etapa 12 — E2E + screenshot diff</li>
            <li>⏳ Etapa 13 — Deploy Docker + Nginx</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
