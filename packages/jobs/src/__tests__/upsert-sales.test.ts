// Adapter integration test — requires Postgres at $DATABASE_URL.
// Skipped automatically when no DATABASE_URL is configured (CI without DB).

import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { NormalizedSale } from '@painel/connectors';
import { upsertSales } from '../adapter/upsert-sales';

const RUN_DB_TESTS = !!process.env['DATABASE_URL'];

const sampleSale = (overrides: Partial<NormalizedSale> = {}): NormalizedSale => ({
  externalId: 'erp-1',
  productSku: 'M4300004',
  productName: 'MACAQUINHO',
  brand: 'MA',
  productLine: 'TEEN',
  productGroup: 'MACAQUINHO',
  coordSeason: 'RESORT 2027',
  priceTier: 'MEDIO',
  designer: 'BRUNA',
  unitPrice: 86.21,
  customerId: 'adapter-test-99001',
  customerName: 'CLIENTE TESTE LTDA',
  customerProfile: 'REGULAR',
  repFullName: 'L N BANDEIRA LTDA',
  cityName: 'TOLEDO',
  ufId: 'PR',
  qty: 7,
  value: 626.4,
  cost: 257.1,
  unitCost: 36.7485,
  date: new Date('2026-04-28'),
  sourceUpdatedAt: new Date('2026-04-28T12:00:00Z'),
  collection: 'V27',
  ...overrides,
});

describe.runIf(RUN_DB_TESTS)('upsertSales · against real Postgres', () => {
  const db = new PrismaClient();
  const SOURCE = 'test-adapter';

  afterAll(async () => {
    await db.sale.deleteMany({ where: { source: SOURCE } });
    await db.customer.deleteMany({ where: { id: { in: ['adapter-test-99001'] } } });
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.sale.deleteMany({ where: { source: SOURCE } });
  });

  it('inserts new sales and reconciles dimensions', async () => {
    const r = await upsertSales(db, SOURCE, [
      sampleSale(),
      sampleSale({ externalId: 'erp-2', qty: 3, value: 268.5 }),
    ]);
    expect(r.recordsIn).toBe(2);
    expect(r.recordsOut).toBe(2);

    const inserted = await db.sale.findMany({ where: { source: SOURCE } });
    expect(inserted).toHaveLength(2);
    expect(inserted.find((s) => s.externalId === 'erp-1')?.qty).toBe(7);

    const customer = await db.customer.findUnique({ where: { id: 'adapter-test-99001' } });
    expect(customer?.name).toBe('CLIENTE TESTE LTDA');
    expect(customer?.profile).toBe('REGULAR');
  });

  it('is idempotent — second run on the same payload is a no-op for counts', async () => {
    const sales = [sampleSale(), sampleSale({ externalId: 'erp-2', qty: 3, value: 268.5 })];
    await upsertSales(db, SOURCE, sales);
    const before = await db.sale.count({ where: { source: SOURCE } });

    await upsertSales(db, SOURCE, sales);
    const after = await db.sale.count({ where: { source: SOURCE } });
    expect(after).toBe(before);
  });

  it('updates an existing sale (same source+externalId) with the new value', async () => {
    await upsertSales(db, SOURCE, [sampleSale({ value: 100 })]);
    await upsertSales(db, SOURCE, [sampleSale({ value: 999 })]);
    const row = await db.sale.findFirst({ where: { source: SOURCE, externalId: 'erp-1' } });
    expect(Number(row?.value)).toBe(999);
  });

  it('returns 0 for empty input without touching the DB', async () => {
    const r = await upsertSales(db, SOURCE, []);
    expect(r).toEqual({
      recordsIn: 0,
      recordsOut: 0,
      newCustomers: 0,
      newProducts: 0,
      newCities: 0,
      newReps: 0,
    });
  });
});
