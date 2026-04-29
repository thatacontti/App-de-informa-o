import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginForm } from './login-form';

export const metadata = {
  title: 'Entrar · Painel V27',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await auth();
  if (session?.user) redirect(searchParams.callbackUrl ?? '/');

  return (
    <div className="rounded-2xl border border-amber/20 bg-paper p-8 shadow-[0_30px_60px_-20px_rgba(74,31,37,0.35)]">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-block rounded-sm border border-amber/30 bg-amber/15 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[3px] text-terra">
          Grupo Catarina
        </span>
        <h1 className="font-display text-3xl font-light leading-none tracking-tight text-deep">
          Painel <b className="font-extrabold italic text-amber">V27</b>
        </h1>
        <p className="mt-2 text-sm text-ink-3">Acesso restrito · Verão 2027</p>
      </div>

      <LoginForm callbackUrl={searchParams.callbackUrl} />

      <p className="mt-6 text-center text-[0.72rem] italic text-ink-3">
        Esqueceu a senha? Procure um administrador.
      </p>
    </div>
  );
}
