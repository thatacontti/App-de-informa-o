'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@painel/shared';
import { cn } from '@/lib/utils';
import { can } from '@/lib/permissions';

const TABS = [
  { href: '/negocio', label: 'Negócio' },
  { href: '/marca-cidade', label: 'Marca · Cidade' },
  { href: '/produto', label: 'Produto · Estratégia' },
  { href: '/mapa', label: 'Mapa de Ataque' },
] as const;

export function TabsNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const adminTabs: Array<{ href: string; label: string }> = [];
  if (can(role, 'admin:datasources')) {
    adminTabs.push({ href: '/admin/datasources', label: 'Fontes' });
  }

  const renderTab = (tab: { href: string; label: string }, isAdmin = false) => {
    const isActive = active(tab.href);
    return (
      <Link
        key={tab.href}
        href={tab.href}
        className={cn(
          'relative px-7 py-[18px] text-[0.86rem] font-medium tracking-wide transition-colors',
          isAdmin && 'text-burnt',
          isActive ? 'font-bold text-deep' : 'text-ink-3 hover:text-terra',
        )}
      >
        {tab.label}
        {isActive && (
          <>
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-terra" />
            <span className="absolute -bottom-[2px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber" />
          </>
        )}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-30 flex items-center gap-0 border-b border-terra/15 bg-paper px-12 shadow-[0_1px_0_rgba(139,74,82,0.05)]">
      {TABS.map((tab) => renderTab(tab))}
      {adminTabs.length > 0 && (
        <>
          <span className="mx-3 h-5 w-px bg-amber/30" />
          {adminTabs.map((tab) => renderTab(tab, true))}
        </>
      )}
    </nav>
  );
}
