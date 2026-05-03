// Sales adapter — turns NormalizedSale[] into Postgres rows.
//
// Idempotent by (source, externalId). Reconciles missing dimensions
// (City, Customer, Product, Representative) before inserting fact rows
// so the foreign keys are guaranteed to resolve.
//
// Performance budget for the V27 snapshot (14 837 rows):
//   - dimension upserts: ~2-3 seconds
//   - sales upserts:     ~3-4 seconds (chunks of 200 in $transaction)
//   - total:             ~5-7 seconds end-to-end on Postgres 16

import type { Prisma, PrismaClient } from '@prisma/client';
import type { NormalizedSale } from '@painel/connectors';

const SALE_CHUNK = 200;

export interface UpsertSalesResult {
  recordsIn: number;
  recordsOut: number;
  newCustomers: number;
  newProducts: number;
  newCities: number;
  newReps: number;
}

export async function upsertSales(
  db: PrismaClient,
  source: string,
  sales: NormalizedSale[],
): Promise<UpsertSalesResult> {
  if (sales.length === 0) {
    return { recordsIn: 0, recordsOut: 0, newCustomers: 0, newProducts: 0, newCities: 0, newReps: 0 };
  }

  // ---- 1. Reconcile dimensions ----
  const newCities = await ensureCities(db, sales);
  const newReps = await ensureReps(db, sales);
  const repByName = await loadRepIndex(db);
  const cityByKey = await loadCityIndex(db);
  const newCustomers = await ensureCustomers(db, sales, cityByKey, repByName);
  const newProducts = await ensureProducts(db, sales);

  // ---- 2. Upsert sales ----
  let recordsOut = 0;
  for (let i = 0; i < sales.length; i += SALE_CHUNK) {
    const slice = sales.slice(i, i + SALE_CHUNK);
    const ops: Prisma.PrismaPromise<unknown>[] = slice.map((s) => {
      const cityId = s.cityName ? (cityByKey.get(`${s.ufId}::${s.cityName}`) ?? null) : null;
      const repId = s.repFullName ? (repByName.get(s.repFullName) ?? null) : null;
      const data = {
        externalId: s.externalId,
        productSku: s.productSku,
        customerId: s.customerId,
        repId,
        cityId,
        ufId: s.ufId,
        brand: s.brand,
        productLine: s.productLine,
        productGroup: s.productGroup,
        priceTier: s.priceTier,
        qty: s.qty,
        value: s.value,
        cost: s.cost,
        unitCost: s.unitCost,
        collection: s.collection,
        date: s.date,
        source,
        sourceUpdatedAt: s.sourceUpdatedAt,
      };
      return db.sale.upsert({
        where: { source_externalId: { source, externalId: s.externalId } },
        update: data,
        create: data,
      });
    });
    await db.$transaction(ops);
    recordsOut += slice.length;
  }

  return {
    recordsIn: sales.length,
    recordsOut,
    newCustomers,
    newProducts,
    newCities,
    newReps,
  };
}

// ---------- dimension reconciliation ----------

async function ensureCities(db: PrismaClient, sales: NormalizedSale[]): Promise<number> {
  const wanted = new Map<string, { name: string; ufId: string }>();
  for (const s of sales) {
    if (!s.cityName) continue;
    const key = `${s.ufId}::${s.cityName}`;
    if (!wanted.has(key)) wanted.set(key, { name: s.cityName, ufId: s.ufId });
  }
  if (wanted.size === 0) return 0;

  const existing = await db.city.findMany({
    where: { OR: [...wanted.values()].map(({ name, ufId }) => ({ name, ufId })) },
    select: { name: true, ufId: true },
  });
  const existingKeys = new Set(existing.map((c) => `${c.ufId}::${c.name}`));
  const toCreate = [...wanted.values()].filter(
    ({ name, ufId }) => !existingKeys.has(`${ufId}::${name}`),
  );
  if (toCreate.length === 0) return 0;

  await db.city.createMany({
    data: toCreate.map((c) => ({ name: c.name, ufId: c.ufId, ibgeTier: 'MICRO' as const })),
    skipDuplicates: true,
  });
  return toCreate.length;
}

async function ensureReps(db: PrismaClient, sales: NormalizedSale[]): Promise<number> {
  const wanted = new Set<string>();
  for (const s of sales) if (s.repFullName) wanted.add(s.repFullName);
  if (wanted.size === 0) return 0;

  const existing = await db.representative.findMany({
    where: { fullName: { in: [...wanted] } },
    select: { fullName: true },
  });
  const existingNames = new Set(existing.map((r) => r.fullName));
  const toCreate = [...wanted].filter((name) => !existingNames.has(name));
  if (toCreate.length === 0) return 0;

  await db.representative.createMany({
    data: toCreate.map((fullName) => ({ fullName, shortName: shortName(fullName), active: true })),
    skipDuplicates: true,
  });
  return toCreate.length;
}

async function ensureCustomers(
  db: PrismaClient,
  sales: NormalizedSale[],
  cityByKey: Map<string, string>,
  repByName: Map<string, string>,
): Promise<number> {
  const wanted = new Map<string, NormalizedSale>();
  for (const s of sales) if (!wanted.has(s.customerId)) wanted.set(s.customerId, s);
  if (wanted.size === 0) return 0;

  const existing = await db.customer.findMany({
    where: { id: { in: [...wanted.keys()] } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));

  let created = 0;
  // Customer creates can't go through createMany cleanly because cityId/repId
  // aren't required on every row — fall back to per-row upsert for the
  // unknowns. The known set is small (<= 301 in the V27 snapshot).
  for (const [id, s] of wanted) {
    const cityId = s.cityName ? (cityByKey.get(`${s.ufId}::${s.cityName}`) ?? null) : null;
    const repId = s.repFullName ? (repByName.get(s.repFullName) ?? null) : null;
    const baseData = {
      id,
      code: id,
      name: s.customerName,
      cityId,
      repId,
      ufId: s.ufId,
    };
    // For historic ingestion (no profile classification yet), don't
    // touch the profile column — let the column default handle creates
    // and preserve any existing classification on updates.
    const data = s.customerProfile
      ? { ...baseData, profile: s.customerProfile }
      : baseData;
    await db.customer.upsert({
      where: { id },
      update: data,
      create: data,
    });
    if (!existingIds.has(id)) created++;
  }
  return created;
}

async function ensureProducts(db: PrismaClient, sales: NormalizedSale[]): Promise<number> {
  const wanted = new Map<string, NormalizedSale>();
  for (const s of sales) if (!wanted.has(s.productSku)) wanted.set(s.productSku, s);
  if (wanted.size === 0) return 0;

  const existing = await db.product.findMany({
    where: { id: { in: [...wanted.keys()] } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));

  let created = 0;
  for (const [sku, s] of wanted) {
    const data = {
      id: sku,
      sku,
      name: s.productName,
      brand: s.brand,
      line: s.productLine,
      productGroup: s.productGroup,
      coordSeason: s.coordSeason ?? null,
      priceTier: s.priceTier,
      unitPrice: s.unitPrice ?? null,
      designer: s.designer ?? null,
    };
    await db.product.upsert({ where: { id: sku }, update: data, create: data });
    if (!existingIds.has(sku)) created++;
  }
  return created;
}

// ---------- index loaders ----------

async function loadRepIndex(db: PrismaClient): Promise<Map<string, string>> {
  const reps = await db.representative.findMany({ select: { id: true, fullName: true } });
  return new Map(reps.map((r) => [r.fullName, r.id]));
}

async function loadCityIndex(db: PrismaClient): Promise<Map<string, string>> {
  const cities = await db.city.findMany({ select: { id: true, name: true, ufId: true } });
  return new Map(cities.map((c) => [`${c.ufId}::${c.name}`, c.id]));
}

// ---------- helpers ----------

function shortName(full: string): string {
  return full
    .replace(
      /(LTDA|ME|EIRELI|REPRESENTACOES?|REPRESENTAÇÃO|REPRESENTAÇÕES|COMERCIAIS?|PRODUTOS|TEXTEIS?)/gi,
      '',
    )
    .replace(/[^\w]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ') || full.slice(0, 16);
}
