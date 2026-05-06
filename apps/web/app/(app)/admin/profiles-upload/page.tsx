import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can } from '@/lib/permissions';
import { ProfilesUploader } from '@/components/admin/profiles-uploader';

export const metadata = { title: 'Upload de perfis · Painel V27' };

export default async function ProfilesUploadPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!can(session.user.role, 'admin:upload')) redirect('/forbidden?action=admin:upload');

  return (
    <div className="mx-auto max-w-[1200px] px-9 py-7">
      <section className="mb-4 rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
        <span className="mb-2 inline-block rounded-sm border border-amber/30 bg-amber/15 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[3px] text-terra">
          Admin · Upload de perfis
        </span>
        <h2 className="font-display text-2xl font-medium text-deep">
          Upload de perfis de cliente (CSV)
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          Suba o CSV exportado do CRM mapeando <code className="font-mono text-terra">codcli → perfil</code>.
          O parser detecta o separador automaticamente (<code className="font-mono">,</code> ou{' '}
          <code className="font-mono">;</code>); a planilha precisa ter pelo menos as colunas{' '}
          <strong>codcli</strong> (ou código/cliente) e <strong>perfil</strong> (ou profile/classificação).
          Perfis aceitos: <strong>VIP 3+</strong>, <strong>VIP</strong>, <strong>FREQUENTE</strong>,{' '}
          <strong>REGULAR</strong>, <strong>NOVO 25</strong>, <strong>NOVO 27</strong>.
        </p>
        <p className="mt-2 max-w-2xl text-[0.78rem] text-ink-3">
          O import é serial (um upsert por vez) para não estourar o rate-limit do banco. A barra
          mostra <code className="font-mono">X de Y · ok=N · falhou=M</code> em tempo real e o botão{' '}
          <strong>Cancelar</strong> interrompe na próxima linha.
        </p>
      </section>

      <ProfilesUploader />
    </div>
  );
}
