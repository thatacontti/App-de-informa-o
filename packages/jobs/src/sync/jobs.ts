// Thin job wrappers — each fetches the DataSource record, builds the
// connector through the shared factory, and hands control to the
// runner. Used both by BullMQ workers (scheduled) and by the tRPC
// triggerSync procedure (manual).

import type { PrismaClient } from '@prisma/client';
import {
  createSaleConnector,
  createTargetConnector,
  defaultFixturesDir,
  type DataSourceSpec,
} from '@painel/connectors';
import { runSaleSync, runTargetSync, type SaleSyncResult, type TargetSyncResult } from './runner';

export interface SyncEnv {
  useMock: boolean;
  fixturesDir?: string;
  /** Repassa pra runSaleSync — auto-reclassifica perfis após upsert. Default true. */
  reclassifyAfterSync?: boolean;
}

function runOpts(env: SyncEnv): { reclassifyAfterSync?: boolean } {
  return env.reclassifyAfterSync === undefined
    ? {}
    : { reclassifyAfterSync: env.reclassifyAfterSync };
}

function spec(ds: {
  type: string;
  name: string;
  endpoint: string;
  configEncrypted?: string | null;
}): DataSourceSpec {
  // configEncrypted é só um nome aspiracional — hoje carrega JSON em
  // texto puro. Os connectors leem campos dele (apiKey, mapperName,
  // serverUrl, view, token, etc.) de acordo com o tipo.
  let config: Record<string, string> | undefined;
  if (ds.configEncrypted) {
    try {
      const parsed = JSON.parse(ds.configEncrypted) as Record<string, unknown>;
      config = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === 'string'),
      ) as Record<string, string>;
    } catch (e) {
      throw new Error(
        `DataSource ${ds.name} (${ds.type}): configEncrypted não é JSON válido — ${(e as Error).message}`,
      );
    }
  }
  return {
    type: ds.type as DataSourceSpec['type'],
    name: ds.name,
    endpoint: ds.endpoint,
    ...(config ? { config } : {}),
  };
}

function fixturesDir(env: SyncEnv): string {
  return env.fixturesDir ?? defaultFixturesDir();
}

export async function syncErpDataSource(
  db: PrismaClient,
  dataSourceId: string,
  env: SyncEnv,
): Promise<SaleSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  if (ds.type !== 'ERP_DB') throw new Error(`syncErpDataSource: expected ERP_DB, got ${ds.type}`);
  const connector = createSaleConnector(spec(ds), { useMock: env.useMock, fixturesDir: fixturesDir(env) });
  return runSaleSync(db, dataSourceId, connector, runOpts(env));
}

export async function syncCrmDataSource(
  db: PrismaClient,
  dataSourceId: string,
  env: SyncEnv,
): Promise<SaleSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  if (ds.type !== 'CRM_API') throw new Error(`syncCrmDataSource: expected CRM_API, got ${ds.type}`);
  const connector = createSaleConnector(spec(ds), { useMock: env.useMock, fixturesDir: fixturesDir(env) });
  return runSaleSync(db, dataSourceId, connector, runOpts(env));
}

export async function syncCsvHistoricoDataSource(
  db: PrismaClient,
  dataSourceId: string,
  env: SyncEnv,
): Promise<SaleSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  if (ds.type !== 'CSV_HISTORICO')
    throw new Error(`syncCsvHistoricoDataSource: expected CSV_HISTORICO, got ${ds.type}`);
  const connector = createSaleConnector(spec(ds), { useMock: env.useMock, fixturesDir: fixturesDir(env) });
  return runSaleSync(db, dataSourceId, connector, runOpts(env));
}

export async function syncBase44DataSource(
  db: PrismaClient,
  dataSourceId: string,
  env: SyncEnv,
): Promise<SaleSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  if (ds.type !== 'BASE44_API')
    throw new Error(`syncBase44DataSource: expected BASE44_API, got ${ds.type}`);
  const connector = createSaleConnector(spec(ds), { useMock: env.useMock, fixturesDir: fixturesDir(env) });
  return runSaleSync(db, dataSourceId, connector, runOpts(env));
}

export async function syncMetasDataSource(
  db: PrismaClient,
  dataSourceId: string,
  env: SyncEnv,
): Promise<TargetSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  if (ds.type !== 'XLSX') throw new Error(`syncMetasDataSource: expected XLSX, got ${ds.type}`);
  const connector = createTargetConnector(spec(ds), { useMock: env.useMock, fixturesDir: fixturesDir(env) });
  return runTargetSync(db, dataSourceId, connector);
}

/** Generic dispatcher used by the BullMQ worker. */
export async function syncDataSource(
  db: PrismaClient,
  dataSourceId: string,
  env: SyncEnv,
): Promise<SaleSyncResult | TargetSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  switch (ds.type) {
    case 'ERP_DB':
      return syncErpDataSource(db, dataSourceId, env);
    case 'CRM_API':
      return syncCrmDataSource(db, dataSourceId, env);
    case 'XLSX':
      return syncMetasDataSource(db, dataSourceId, env);
    case 'CSV_HISTORICO':
      return syncCsvHistoricoDataSource(db, dataSourceId, env);
    case 'BASE44_API':
      return syncBase44DataSource(db, dataSourceId, env);
  }
}

/** Connector test — never modifies state. */
export async function testDataSource(
  db: PrismaClient,
  dataSourceId: string,
  env: SyncEnv,
) {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  const opts = { useMock: env.useMock, fixturesDir: fixturesDir(env) };
  const connector =
    ds.type === 'XLSX'
      ? createTargetConnector(spec(ds), opts)
      : createSaleConnector(spec(ds), opts);
  return connector.test();
}
