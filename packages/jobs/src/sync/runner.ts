// Sync runner — wraps the lifecycle every sync job follows:
//   1. Open a SyncRun(status: RUNNING)
//   2. Call connector.extract(lastSyncAt)
//   3. Hand the result to the upsert adapter
//   4. Close the SyncRun, update DataSource.lastSyncAt/status
//   5. Audit + alert on failure
//
// Returns the SyncRun summary so the caller (BullMQ worker, tRPC
// procedure) can report progress.

import type { PrismaClient } from '@prisma/client';
import type {
  NormalizedSale,
  NormalizedTarget,
  SaleConnector,
  TargetConnector,
} from '@painel/connectors';
import { upsertSales, type UpsertSalesResult } from '../adapter/upsert-sales';
import { upsertTargets, type UpsertTargetsResult } from '../adapter/upsert-targets';
import { postSlack } from '../notifications/slack';
import { checkAndAlertDeviations } from '../alerts/deviation';

export interface SaleSyncResult {
  syncRunId: string;
  status: 'SUCCESS' | 'FAILED';
  recordsIn: number;
  recordsOut: number;
  durationMs: number;
  newCustomers: number;
  newProducts: number;
  newCities: number;
  newReps: number;
  errorMessage?: string;
}

export interface TargetSyncResult {
  syncRunId: string;
  status: 'SUCCESS' | 'FAILED';
  recordsIn: number;
  recordsOut: number;
  durationMs: number;
  errorMessage?: string;
}

export async function runSaleSync(
  db: PrismaClient,
  dataSourceId: string,
  connector: SaleConnector,
): Promise<SaleSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
  const since = ds.lastSyncAt ?? new Date(0);

  const run = await db.syncRun.create({
    data: { dataSourceId, status: 'RUNNING', startedAt: new Date() },
  });
  const t0 = Date.now();

  try {
    const sales: NormalizedSale[] = await connector.extract(since);
    const r: UpsertSalesResult = await upsertSales(db, ds.type, sales);
    const finishedAt = new Date();

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt,
        recordsIn: r.recordsIn,
        recordsOut: r.recordsOut,
        status: 'SUCCESS',
      },
    });
    await db.dataSource.update({
      where: { id: dataSourceId },
      data: { lastSyncAt: finishedAt, lastSyncStatus: 'SUCCESS', lastSyncError: null },
    });
    await db.auditLog.create({
      data: {
        action: 'sync.success',
        payload: {
          dataSourceId,
          dataSourceType: ds.type,
          recordsIn: r.recordsIn,
          recordsOut: r.recordsOut,
          newCustomers: r.newCustomers,
          newProducts: r.newProducts,
          newCities: r.newCities,
          newReps: r.newReps,
        },
      },
    });

    // Fire-and-forget deviation alerts after a successful sale ingest.
    // We swallow errors so the sync stays SUCCESS even if Slack misbehaves.
    await checkAndAlertDeviations(db, { source: ds.type }).catch(() => undefined);

    return {
      syncRunId: run.id,
      status: 'SUCCESS',
      durationMs: Date.now() - t0,
      ...r,
    };
  } catch (err) {
    return handleFailure(db, run.id, dataSourceId, ds.type, ds.name, t0, err);
  }
}

export async function runTargetSync(
  db: PrismaClient,
  dataSourceId: string,
  connector: TargetConnector,
): Promise<TargetSyncResult> {
  const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });

  const run = await db.syncRun.create({
    data: { dataSourceId, status: 'RUNNING', startedAt: new Date() },
  });
  const t0 = Date.now();

  try {
    const targets: NormalizedTarget[] = await connector.extract(ds.lastSyncAt ?? undefined);
    const r: UpsertTargetsResult = await upsertTargets(db, targets);
    const finishedAt = new Date();

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt,
        recordsIn: r.recordsIn,
        recordsOut: r.recordsOut,
        status: 'SUCCESS',
      },
    });
    await db.dataSource.update({
      where: { id: dataSourceId },
      data: { lastSyncAt: finishedAt, lastSyncStatus: 'SUCCESS', lastSyncError: null },
    });
    await db.auditLog.create({
      data: {
        action: 'sync.success',
        payload: {
          dataSourceId,
          dataSourceType: ds.type,
          recordsIn: r.recordsIn,
          recordsOut: r.recordsOut,
        },
      },
    });

    return { syncRunId: run.id, status: 'SUCCESS', durationMs: Date.now() - t0, ...r };
  } catch (err) {
    return handleFailure(db, run.id, dataSourceId, ds.type, ds.name, t0, err);
  }
}

async function handleFailure(
  db: PrismaClient,
  syncRunId: string,
  dataSourceId: string,
  dsType: string,
  dsName: string,
  t0: number,
  err: unknown,
): Promise<SaleSyncResult & TargetSyncResult> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const finishedAt = new Date();
  await db.syncRun.update({
    where: { id: syncRunId },
    data: { finishedAt, status: 'FAILED', errorMessage },
  });
  await db.dataSource.update({
    where: { id: dataSourceId },
    data: { lastSyncAt: finishedAt, lastSyncStatus: 'FAILED', lastSyncError: errorMessage },
  });
  await db.auditLog.create({
    data: { action: 'sync.failed', payload: { dataSourceId, dsType, errorMessage } },
  });
  await postSlack({
    text: `:rotating_light: *Sync FAILED* · ${dsName} (${dsType}) — ${errorMessage}`,
  }).catch(() => undefined);

  return {
    syncRunId,
    status: 'FAILED',
    durationMs: Date.now() - t0,
    recordsIn: 0,
    recordsOut: 0,
    newCustomers: 0,
    newProducts: 0,
    newCities: 0,
    newReps: 0,
    errorMessage,
  };
}
