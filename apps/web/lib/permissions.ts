import type { Role } from '@painel/shared';

// ---------- Action surface ----------

export const ACTIONS = [
  // Read views (one per tab in the panel)
  'view:negocio',
  'view:marca-cidade',
  'view:produto',
  'view:mapa',

  // R$ ↔ Peças toggle. ANALISTA stays locked to PRODUTO (peças).
  'view:diretoria-mode',

  // Briefing export (PDF, Slack, weekly job button)
  'export:briefing-pdf',

  // Data export. Level encodes raw vs aggregated only.
  'export:data',

  // Admin surface
  'admin:users',
  'admin:datasources',
  'admin:trigger-sync',
  'admin:audit',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * Permission outcome.
 *  - 'allow'      = full permission
 *  - 'deny'       = blocked
 *  - 'read'       = read-only (datasources)
 *  - 'aggregated' = only aggregated values (no raw rows)
 *  - 'raw'        = full data including individual rows
 */
export type PermissionLevel = 'allow' | 'deny' | 'read' | 'aggregated' | 'raw';

// ---------- Matrix ----------
// Mirrors the table in the briefing (section 5).
export const PERMISSION_MATRIX: Record<Role, Record<Action, PermissionLevel>> = {
  ADMIN: {
    'view:negocio': 'allow',
    'view:marca-cidade': 'allow',
    'view:produto': 'allow',
    'view:mapa': 'allow',
    'view:diretoria-mode': 'allow',
    'export:briefing-pdf': 'allow',
    'export:data': 'raw',
    'admin:users': 'allow',
    'admin:datasources': 'allow',
    'admin:trigger-sync': 'allow',
    'admin:audit': 'allow',
  },
  GESTOR: {
    'view:negocio': 'allow',
    'view:marca-cidade': 'allow',
    'view:produto': 'allow',
    'view:mapa': 'allow',
    'view:diretoria-mode': 'allow',
    'export:briefing-pdf': 'allow',
    'export:data': 'aggregated',
    'admin:users': 'deny',
    'admin:datasources': 'read',
    'admin:trigger-sync': 'deny',
    'admin:audit': 'deny',
  },
  ANALISTA: {
    'view:negocio': 'allow',
    'view:marca-cidade': 'allow',
    'view:produto': 'allow',
    'view:mapa': 'allow',
    'view:diretoria-mode': 'deny',
    'export:briefing-pdf': 'deny',
    'export:data': 'aggregated',
    'admin:users': 'deny',
    'admin:datasources': 'read',
    'admin:trigger-sync': 'deny',
    'admin:audit': 'deny',
  },
};

// ---------- Helpers ----------

export function can(role: Role, action: Action): boolean {
  return permissionLevel(role, action) !== 'deny';
}

export function permissionLevel(role: Role, action: Action): PermissionLevel {
  // Matrix is exhaustive by construction (Record<Role, Record<Action, ...>>),
  // but `noUncheckedIndexedAccess` widens the lookup — assert non-null.
  return PERMISSION_MATRIX[role]![action]!;
}

export class ForbiddenError extends Error {
  constructor(role: Role, action: Action) {
    super(`Forbidden: role ${role} cannot ${action}`);
    this.name = 'ForbiddenError';
  }
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError(role, action);
}

// ---------- Route gates ----------
// Used by middleware.ts to translate URL paths to required actions.

export const ROUTE_PERMISSIONS: ReadonlyArray<{ pattern: RegExp; action: Action }> = [
  { pattern: /^\/negocio(\/|$)/, action: 'view:negocio' },
  { pattern: /^\/marca-cidade(\/|$)/, action: 'view:marca-cidade' },
  { pattern: /^\/produto(\/|$)/, action: 'view:produto' },
  { pattern: /^\/mapa(\/|$)/, action: 'view:mapa' },
  { pattern: /^\/admin\/users(\/|$)/, action: 'admin:users' },
  { pattern: /^\/admin\/datasources(\/|$)/, action: 'admin:datasources' },
  { pattern: /^\/admin\/audit(\/|$)/, action: 'admin:audit' },
];

export function actionForPath(pathname: string): Action | null {
  for (const { pattern, action } of ROUTE_PERMISSIONS) {
    if (pattern.test(pathname)) return action;
  }
  return null;
}
