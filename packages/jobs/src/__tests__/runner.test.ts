// Sync runner test — exercises the lifecycle (RUNNING → SUCCESS / FAILED)
// using the FixtureSaleConnector against a tiny in-memory subset of the
// real fixture data. Requires Postgres.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { NormalizedSale, SaleConnector } from '@painel/connectors';
import { runSaleSync } from '../sync/runner';

const RUN_DB_TESTS = !!process.env['DATABASE_URL'];

class StubSaleConnector implements SaleConnector {
  readonly type = 'ERP_DB' as const;
  readonly name: string;
  constructor(
    private readonly batch: NormalizedSale[],
    private readonly fail: boolean = false,
    name = 'stub-erp',
  ) {
    this.name = name;
  }
  async test() {
    return { ok: true } as const;
  }
  async extract() {
    if (this.fail) throw new Error('upstream timed out');
    return this.batch;
  }
}

const sale = (id: string): NormalizedSale => ({
  externalId: id,
  productSku: 'TST-1',
  productName: 'PRODUTO TESTE',
  brand: 'KIKI',
  productLine: 'INFANTIL',
  productGroup: 'VESTIDO',
  priceTier: 'MEDIO',
  customerId: '99002',
  customerName: 'CLIENTE RUNNER LTDA',
  customerProfile: 'VIP',
  ufId: 'SP',
  cityName: 'SAO PAULO',
  qty: 5,
  value: 500,
  date: new Date('2026-04-28'),
  sourceUpdatedAt: new Date('2026-04-28T12:00:00Z'),
});

describe.runIf(RUN_DB_TESTS)('runSaleSync · lifecycle', () => {
  const db = new PrismaClient();
  let dataSourceId: string;

  beforeEach(async () => {
    await db.sale.deleteMany({ where: { source: 'ERP_DB' } });
    const ds = await db.dataSource.upsert({
      where: { type_name: { type: 'ERP_DB', name: 'test-runner-erp' } },
      update: { lastSyncAt: null, lastSyncStatus: null, lastSyncError: null },
      create: {
        type: 'ERP_DB',
        name: 'test-runner-erp',
        endpoint: 'fixture://',
        frequencyMinutes: 5,
        active: true,
      },
    });
    dataSourceId = ds.id;
  });

  afterAll(async () => {
    await db.dataSource.delete({ where: { id: dataSourceId } }).catch(() => {});
    await db.sale.deleteMany({ where: { customerId: '99002' } });
    await db.customer.deleteMany({ where: { id: '99002' } });
    await db.product.deleteMany({ where: { id: 'TST-1' } });
    await db.$disconnect();
  });

  it('SUCCESS path: opens SyncRun, calls connector, closes run, updates DataSource', async () => {
    const stub = new StubSaleConnector([sale('r-1'), sale('r-2'), sale('r-3')]);
    const r = await runSaleSync(db, dataSourceId, stub);

    expect(r.status).toBe('SUCCESS');
    expect(r.recordsIn).toBe(3);
    expect(r.recordsOut).toBe(3);

    const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
    expect(ds.lastSyncStatus).toBe('SUCCESS');
    expect(ds.lastSyncAt).toBeTruthy();
    expect(ds.lastSyncError).toBeNull();

    const run = await db.syncRun.findUniqueOrThrow({ where: { id: r.syncRunId } });
    expect(run.status).toBe('SUCCESS');
    expect(run.recordsIn).toBe(3);

    const audit = await db.auditLog.findFirst({
      where: { action: 'sync.success' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.payload).toMatchObject({ dataSourceId, recordsIn: 3, recordsOut: 3 });
  });

  it('FAILED path: marks run as FAILED, captures error, audits sync.failed', async () => {
    const stub = new StubSaleConnector([], true);
    const r = await runSaleSync(db, dataSourceId, stub);

    expect(r.status).toBe('FAILED');
    expect(r.errorMessage).toContain('upstream timed out');

    const ds = await db.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } });
    expect(ds.lastSyncStatus).toBe('FAILED');
    expect(ds.lastSyncError).toContain('upstream timed out');

    const audit = await db.auditLog.findFirst({
      where: { action: 'sync.failed' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.payload).toMatchObject({ dataSourceId });
  });
});
