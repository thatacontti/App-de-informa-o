import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  PERMISSION_MATRIX,
  actionForPath,
  assertCan,
  can,
  permissionLevel,
  ForbiddenError,
} from '../permissions';

describe('permissions matrix · structural', () => {
  it('declares every action for every role', () => {
    for (const role of ['ADMIN', 'GESTOR', 'ANALISTA'] as const) {
      for (const action of ACTIONS) {
        const row = PERMISSION_MATRIX[role];
        expect(row?.[action]).toBeDefined();
      }
    }
  });
});

describe('permissions matrix · row by row (mirrors briefing section 5)', () => {
  it('Negócio · SSS — Total/Total/Total', () => {
    expect(can('ADMIN', 'view:negocio')).toBe(true);
    expect(can('GESTOR', 'view:negocio')).toBe(true);
    expect(can('ANALISTA', 'view:negocio')).toBe(true);
  });

  it('Marca · Cidade — Total/Total/Total', () => {
    expect(can('ADMIN', 'view:marca-cidade')).toBe(true);
    expect(can('GESTOR', 'view:marca-cidade')).toBe(true);
    expect(can('ANALISTA', 'view:marca-cidade')).toBe(true);
  });

  it('Produto · Estratégia — Total/Total/Total', () => {
    expect(can('ADMIN', 'view:produto')).toBe(true);
    expect(can('GESTOR', 'view:produto')).toBe(true);
    expect(can('ANALISTA', 'view:produto')).toBe(true);
  });

  it('Mapa de Ataque — Total/Total/Total', () => {
    expect(can('ADMIN', 'view:mapa')).toBe(true);
    expect(can('GESTOR', 'view:mapa')).toBe(true);
    expect(can('ANALISTA', 'view:mapa')).toBe(true);
  });

  it('Diretoria · Briefing — Total/Total/Negado', () => {
    expect(can('ADMIN', 'view:diretoria-mode')).toBe(true);
    expect(can('GESTOR', 'view:diretoria-mode')).toBe(true);
    expect(can('ANALISTA', 'view:diretoria-mode')).toBe(false);
    expect(can('ADMIN', 'export:briefing-pdf')).toBe(true);
    expect(can('GESTOR', 'export:briefing-pdf')).toBe(true);
    expect(can('ANALISTA', 'export:briefing-pdf')).toBe(false);
  });

  it('Exportar dados — raw/aggregated/aggregated', () => {
    expect(permissionLevel('ADMIN', 'export:data')).toBe('raw');
    expect(permissionLevel('GESTOR', 'export:data')).toBe('aggregated');
    expect(permissionLevel('ANALISTA', 'export:data')).toBe('aggregated');
  });

  it('Gerenciar usuários — Total/Negado/Negado', () => {
    expect(can('ADMIN', 'admin:users')).toBe(true);
    expect(can('GESTOR', 'admin:users')).toBe(false);
    expect(can('ANALISTA', 'admin:users')).toBe(false);
  });

  it('Gerenciar fontes — Total/Leitura/Leitura', () => {
    expect(permissionLevel('ADMIN', 'admin:datasources')).toBe('allow');
    expect(permissionLevel('GESTOR', 'admin:datasources')).toBe('read');
    expect(permissionLevel('ANALISTA', 'admin:datasources')).toBe('read');
    expect(can('GESTOR', 'admin:datasources')).toBe(true);
    expect(can('ANALISTA', 'admin:datasources')).toBe(true);
  });

  it('Disparar sync — Total/Negado/Negado', () => {
    expect(can('ADMIN', 'admin:trigger-sync')).toBe(true);
    expect(can('GESTOR', 'admin:trigger-sync')).toBe(false);
    expect(can('ANALISTA', 'admin:trigger-sync')).toBe(false);
  });

  it('Auditoria — Total/Negado/Negado', () => {
    expect(can('ADMIN', 'admin:audit')).toBe(true);
    expect(can('GESTOR', 'admin:audit')).toBe(false);
    expect(can('ANALISTA', 'admin:audit')).toBe(false);
  });
});

describe('assertCan', () => {
  it('throws ForbiddenError for denied actions', () => {
    expect(() => assertCan('ANALISTA', 'view:diretoria-mode')).toThrowError(ForbiddenError);
  });
  it('does not throw for allowed actions', () => {
    expect(() => assertCan('ANALISTA', 'view:negocio')).not.toThrow();
  });
});

describe('actionForPath', () => {
  it('maps tab paths', () => {
    expect(actionForPath('/negocio')).toBe('view:negocio');
    expect(actionForPath('/negocio/foo')).toBe('view:negocio');
    expect(actionForPath('/marca-cidade')).toBe('view:marca-cidade');
    expect(actionForPath('/produto')).toBe('view:produto');
    expect(actionForPath('/mapa')).toBe('view:mapa');
  });
  it('maps admin paths', () => {
    expect(actionForPath('/admin/users')).toBe('admin:users');
    expect(actionForPath('/admin/datasources')).toBe('admin:datasources');
    expect(actionForPath('/admin/audit')).toBe('admin:audit');
  });
  it('returns null for public/unknown paths', () => {
    expect(actionForPath('/login')).toBeNull();
    expect(actionForPath('/')).toBeNull();
  });
});
