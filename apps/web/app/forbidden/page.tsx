import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Acesso negado · Painel V27' };

export default function ForbiddenPage({
  searchParams,
}: {
  searchParams: { action?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-rust/20 bg-paper p-8 text-center shadow-lg">
        <span className="mb-3 inline-block rounded-sm border border-rust/30 bg-rust/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[3px] text-rust">
          403
        </span>
        <h1 className="font-display text-2xl font-medium text-deep">Acesso negado</h1>
        <p className="mt-2 text-sm text-ink-3">
          Seu perfil não tem permissão para esta área.
          {searchParams.action ? (
            <>
              {' '}Ação requerida: <code className="font-mono text-terra">{searchParams.action}</code>
            </>
          ) : null}
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Voltar ao painel</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
