import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can } from '@/lib/permissions';
import { DataSourcesTable } from '@/components/admin/data-sources-table';

export const metadata = { title: 'Fontes de dados · Painel V27' };

export default async function DataSourcesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!can(session.user.role, 'admin:datasources')) redirect('/forbidden?action=admin:datasources');

  return (
    <div className="mx-auto max-w-[1500px] px-9 py-7">
      <section className="mb-4 rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
        <span className="mb-2 inline-block rounded-sm border border-amber/30 bg-amber/15 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[3px] text-terra">
          Admin · Fontes
        </span>
        <h2 className="font-display text-2xl font-medium text-deep">Fontes de dados</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          ERP · CRM · SharePoint. Use <strong>Testar</strong> para validar o endpoint sem alterar nada,
          e <strong>Sincronizar</strong> para disparar uma execução manual{' '}
          {can(session.user.role, 'admin:trigger-sync') ? '' : '(só Admin)'}. As syncs agendadas rodam no worker BullMQ.
        </p>
      </section>

      <DataSourcesTable role={session.user.role} />
    </div>
  );
}
