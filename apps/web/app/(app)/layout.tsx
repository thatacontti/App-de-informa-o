import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { UserBadge } from '@/components/auth/user-badge';
import { TabsNav } from '@/components/app/tabs-nav';
import { FilterBar } from '@/components/app/filter-bar';
import { ViewModeToggle } from '@/components/app/view-mode-toggle';
import { TrpcProvider } from '@/components/providers/trpc-provider';
import { FilterProvider } from '@/lib/filter-context';
import { can } from '@/lib/permissions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const { name, email, role } = session.user;
  const canToggle = can(role, 'view:diretoria-mode');

  return (
    <TrpcProvider>
      <FilterProvider initialViewMode={canToggle ? 'DIRETORIA' : 'PRODUTO'} canToggleViewMode={canToggle}>
        <header className="bg-hero-gradient relative overflow-hidden px-12 pb-14 pt-12 text-paper">
          <div className="absolute right-[-10%] top-[-50%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(212,146,143,0.32)_0%,transparent_70%)]" />
          <div className="relative mx-auto flex max-w-[1500px] items-start justify-between gap-6">
            <div>
              <span className="mb-3 inline-block rounded-sm border border-amber/30 bg-amber/20 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[3px] text-amber">
                Painel V27 · Verão 2027
              </span>
              <h1 className="font-display text-[3rem] font-light leading-none tracking-tight">
                Verão <b className="font-extrabold italic text-amber">2027</b> · Grupo Catarina
              </h1>
              <p className="mt-3 max-w-[720px] text-[0.92rem] font-light leading-relaxed opacity-90">
                Direção estratégica · SSS real · Otimização de mix · Faixas de preço · Imagens completas
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <UserBadge name={name} email={email} role={role} />
              <ViewModeToggle />
            </div>
          </div>
        </header>

        <TabsNav role={role} />
        <FilterBar />

        <main className="relative pb-12">{children}</main>
      </FilterProvider>
    </TrpcProvider>
  );
}
