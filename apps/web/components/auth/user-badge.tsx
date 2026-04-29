import { signOut } from '@/auth';
import type { Role } from '@painel/shared';

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  GESTOR: 'Gestor',
  ANALISTA: 'Analista',
};

const ROLE_COLOR: Record<Role, string> = {
  ADMIN: 'bg-deep text-paper',
  GESTOR: 'bg-terra text-paper',
  ANALISTA: 'bg-burnt text-paper',
};

export function UserBadge({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: Role;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-[0.78rem] font-medium leading-tight text-paper">{name}</div>
        <div className="text-[0.65rem] uppercase tracking-[1px] text-amber/90">{email}</div>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[1px] ${ROLE_COLOR[role]}`}
      >
        {ROLE_LABEL[role]}
      </span>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button
          type="submit"
          className="rounded-full border border-amber/30 px-3 py-1 text-[0.7rem] font-medium text-amber transition-colors hover:border-amber hover:bg-amber/10"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
