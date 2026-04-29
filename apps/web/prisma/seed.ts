// Painel V27 · Domain seed
//
// Step 3 — populates Postgres with:
//   · 27 Brazilian UFs
//   · ~213 cities with IBGE tier (from cidade_perfil.json fixture)
//   · 26 representatives (from d_v12.json reps_full)
//   · ~301 customers + their V26 baseline per brand
//   · 358 SKUs / Products
//   · ~14 837 Sale rows (the V27 commercial preview snapshot)
//   · 3 DataSources (ERP / CRM / SharePoint XLSX) with placeholder URLs
//   · 4 sample Targets (one global + one per brand)
//   · 3 default Users (idempotent — same as step 2 seed)
//
// Idempotent: the script truncates fact tables (Sale, V26 baseline) and
// upserts the dimensions, so re-running it produces the same state.

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  Brand,
  CustomerProfile,
  DataSourceType,
  IbgePopulationTier,
  PrismaClient,
  ProductLine,
  PriceTier,
  Role,
  TargetScope,
  TargetUnit,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

import {
  BRAND_FROM_LABEL,
  CUSTOMER_PROFILE_FROM_LABEL,
  IBGE_TIER_FROM_LABEL,
  LINE_FROM_LABEL,
  PRICE_TIER_FROM_LABEL,
  UFS_BR,
} from '@painel/shared';

const prisma = new PrismaClient();

// =====================================================
// Fixture loaders
// =====================================================

const FIXTURES_DIR = path.resolve(__dirname, '../../..', 'painel_v27');

interface Rec {
  p: string; dp: string; m: string; l: string; g: string; co: string;
  uf: string; cid: string; c: number; nm: string; rp: string; pf: string;
  f26: number; q: number; f: number; ct: number; cu: number; fx: string; est: string;
}

interface Fixture {
  recs: Rec[];
  reps_full: Array<{ full: string; short: string; fat: number }>;
  pm_marca_v27: Record<string, number>;
}

interface CityProfile { perfil: string; pop_mil: number }

function loadFixtures() {
  const d: Fixture = JSON.parse(readFileSync(path.join(FIXTURES_DIR, 'd_v12.json'), 'utf-8'));
  const cp: Record<string, CityProfile> = JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, 'cidade_perfil.json'), 'utf-8'),
  );
  const v26m: Record<string, Record<string, number>> = JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, 'v26_por_marca.json'), 'utf-8'),
  );
  return { d, cp, v26m };
}

// =====================================================
// Mapping helpers
// =====================================================

const SNAPSHOT_DATE = new Date('2026-04-28T00:00:00Z');

const mapBrand = (label: string): Brand => {
  const k = BRAND_FROM_LABEL[label];
  if (!k) throw new Error(`unknown brand label: ${label}`);
  return k as Brand;
};
const mapLine = (label: string): ProductLine => {
  const k = LINE_FROM_LABEL[label];
  if (!k) throw new Error(`unknown line label: ${label}`);
  return k as ProductLine;
};
const mapTier = (label: string): PriceTier => {
  const k = PRICE_TIER_FROM_LABEL[label];
  if (!k) throw new Error(`unknown price tier label: ${label}`);
  return k as PriceTier;
};
const mapProfile = (label: string): CustomerProfile => {
  const k = CUSTOMER_PROFILE_FROM_LABEL[label];
  if (!k) throw new Error(`unknown profile label: ${label}`);
  return k as CustomerProfile;
};
const mapIbge = (label?: string): IbgePopulationTier => {
  if (!label) return 'MICRO' as IbgePopulationTier;
  const k = IBGE_TIER_FROM_LABEL[label];
  return (k ?? 'MICRO') as IbgePopulationTier;
};

const repShort = (full: string) =>
  full
    .replace(/(LTDA|ME|EIRELI|REPRESENTACOES?|REPRESENTAÇÃO|REPRESENTAÇÕES|COMERCIAIS?|PRODUTOS|TEXTEIS?)/gi, '')
    .replace(/[^\w]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');

// =====================================================
// Seed sections
// =====================================================

async function seedUsers() {
  const passwordHash = await bcrypt.hash('Catarina2026!', 12);
  const users: Array<{ email: string; name: string; role: Role }> = [
    { email: 'admin@catarina.local', name: 'Administrador', role: 'ADMIN' },
    { email: 'gestor@catarina.local', name: 'Gestor Comercial', role: 'GESTOR' },
    { email: 'analista@catarina.local', name: 'Analista de Mix', role: 'ANALISTA' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { ...u, passwordHash, active: true },
    });
  }
  return users.length;
}

async function seedUFs() {
  for (const u of UFS_BR) {
    await prisma.uF.upsert({
      where: { id: u.id },
      update: { name: u.name, region: u.region },
      create: { id: u.id, name: u.name, region: u.region },
    });
  }
  return UFS_BR.length;
}

async function seedCities(d: Fixture, cp: Record<string, CityProfile>) {
  const seen = new Map<string, { name: string; ufId: string; tier: IbgePopulationTier; popK: number | null }>();
  for (const r of d.recs) {
    const name = r.cid.trim();
    const ufId = r.uf;
    const key = `${ufId}::${name}`;
    if (seen.has(key)) continue;
    const profile = cp[name] ?? cp[r.cid];
    seen.set(key, {
      name,
      ufId,
      tier: mapIbge(profile?.perfil),
      popK: profile?.pop_mil ?? null,
    });
  }

  const cities = [...seen.values()];
  for (const c of cities) {
    await prisma.city.upsert({
      where: { ufId_name: { ufId: c.ufId, name: c.name } },
      update: { ibgeTier: c.tier, popK: c.popK },
      create: { name: c.name, ufId: c.ufId, ibgeTier: c.tier, popK: c.popK },
    });
  }
  return cities.length;
}

async function seedReps(d: Fixture) {
  for (const r of d.reps_full) {
    await prisma.representative.upsert({
      where: { fullName: r.full },
      update: { shortName: r.short, active: true },
      create: { fullName: r.full, shortName: r.short, active: true },
    });
  }

  // Build rep ↔ UF coverage from the records.
  const repUfPairs = new Set<string>();
  for (const r of d.recs) repUfPairs.add(`${r.rp}::${r.uf}`);
  for (const pair of repUfPairs) {
    const [fullName, ufId] = pair.split('::') as [string, string];
    const rep = await prisma.representative.findUnique({ where: { fullName } });
    if (!rep) continue;
    await prisma.repUF.upsert({
      where: { repId_ufId: { repId: rep.id, ufId } },
      update: {},
      create: { repId: rep.id, ufId },
    });
  }
  return d.reps_full.length;
}

async function seedCustomers(d: Fixture) {
  const cityCache = new Map<string, string>();
  async function cityIdFor(name: string, ufId: string): Promise<string | null> {
    const key = `${ufId}::${name}`;
    if (cityCache.has(key)) return cityCache.get(key)!;
    const c = await prisma.city.findUnique({ where: { ufId_name: { ufId, name } } });
    if (c) cityCache.set(key, c.id);
    return c?.id ?? null;
  }
  const repCache = new Map<string, string>();
  async function repIdFor(fullName: string): Promise<string | null> {
    if (repCache.has(fullName)) return repCache.get(fullName)!;
    const r = await prisma.representative.findUnique({ where: { fullName } });
    if (r) repCache.set(fullName, r.id);
    return r?.id ?? null;
  }

  const seen = new Map<string, Rec>();
  for (const r of d.recs) {
    const id = String(r.c);
    if (!seen.has(id)) seen.set(id, r);
  }

  let n = 0;
  for (const [id, r] of seen) {
    const cityId = await cityIdFor(r.cid.trim(), r.uf);
    const repId = await repIdFor(r.rp);
    await prisma.customer.upsert({
      where: { id },
      update: {
        name: r.nm,
        profile: mapProfile(r.pf),
        cityId,
        repId,
        ufId: r.uf,
      },
      create: {
        id,
        code: id,
        name: r.nm,
        profile: mapProfile(r.pf),
        cityId,
        repId,
        ufId: r.uf,
      },
    });
    n++;
  }
  return n;
}

async function seedProducts(d: Fixture) {
  const seen = new Map<string, { rec: Rec; totalValue: number; totalQty: number }>();
  for (const r of d.recs) {
    const cur = seen.get(r.p);
    if (cur) {
      cur.totalValue += r.f;
      cur.totalQty += r.q;
    } else {
      seen.set(r.p, { rec: r, totalValue: r.f, totalQty: r.q });
    }
  }

  let n = 0;
  for (const [sku, agg] of seen) {
    const r = agg.rec;
    const unitPrice = agg.totalQty ? agg.totalValue / agg.totalQty : null;
    await prisma.product.upsert({
      where: { id: sku },
      update: {
        name: r.dp,
        brand: mapBrand(r.m),
        line: mapLine(r.l),
        productGroup: r.g,
        coordSeason: r.co || null,
        priceTier: mapTier(r.fx),
        unitPrice: unitPrice ?? undefined,
        designer: r.est?.trim() || null,
      },
      create: {
        id: sku,
        sku,
        name: r.dp,
        brand: mapBrand(r.m),
        line: mapLine(r.l),
        productGroup: r.g,
        coordSeason: r.co || null,
        priceTier: mapTier(r.fx),
        unitPrice: unitPrice ?? undefined,
        designer: r.est?.trim() || null,
      },
    });
    n++;
  }
  return n;
}

async function seedSales(d: Fixture) {
  await prisma.sale.deleteMany({});

  // Build the rep map once.
  const reps = await prisma.representative.findMany({ select: { id: true, fullName: true } });
  const repByName = new Map(reps.map((r) => [r.fullName, r.id]));

  const cities = await prisma.city.findMany({ select: { id: true, name: true, ufId: true } });
  const cityByKey = new Map(cities.map((c) => [`${c.ufId}::${c.name}`, c.id]));

  const rows = d.recs.map((r, idx) => ({
    externalId: `fixture-${idx}`,
    productSku: r.p,
    customerId: String(r.c),
    repId: repByName.get(r.rp) ?? null,
    cityId: cityByKey.get(`${r.uf}::${r.cid.trim()}`) ?? null,
    ufId: r.uf,
    brand: mapBrand(r.m),
    productLine: mapLine(r.l),
    productGroup: r.g,
    priceTier: mapTier(r.fx),
    qty: r.q,
    value: r.f,
    cost: r.ct,
    unitCost: r.cu,
    date: SNAPSHOT_DATE,
    source: 'fixture',
    sourceUpdatedAt: SNAPSHOT_DATE,
  }));

  // Postgres caps parameters per statement; chunk the bulk insert.
  const CHUNK = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const r = await prisma.sale.createMany({ data: slice, skipDuplicates: false });
    inserted += r.count;
  }
  return inserted;
}

async function seedV26Baseline(v26m: Record<string, Record<string, number>>) {
  await prisma.customerBrandRevenue.deleteMany({ where: { period: 'V26' } });

  const knownCustomers = new Set(
    (await prisma.customer.findMany({ select: { id: true } })).map((c) => c.id),
  );

  const rows: { customerId: string; brand: Brand; period: string; value: number }[] = [];
  for (const [cid, byBrand] of Object.entries(v26m)) {
    if (!knownCustomers.has(cid)) continue; // V26 customers without V27 sales — skipped
    for (const [label, value] of Object.entries(byBrand)) {
      rows.push({ customerId: cid, brand: mapBrand(label), period: 'V26', value });
    }
  }

  const CHUNK = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const r = await prisma.customerBrandRevenue.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    inserted += r.count;
  }
  return inserted;
}

async function seedDataSources() {
  const sources: Array<{
    type: DataSourceType;
    name: string;
    endpoint: string;
    frequencyMinutes: number;
  }> = [
    {
      type: 'ERP_DB',
      name: 'ERP · Vendas',
      endpoint: 'postgresql://srv-erp.catarina.local:5432/vendas?view=vw_painel_v27',
      frequencyMinutes: 5,
    },
    {
      type: 'CRM_API',
      name: 'CRM · Deals',
      endpoint: 'https://api.crm-catarina.com/v2/deals',
      frequencyMinutes: 5,
    },
    {
      type: 'XLSX',
      name: 'SharePoint · Metas V27',
      endpoint: '/Diretoria/Metas/V27.xlsx',
      frequencyMinutes: 60 * 24, // daily
    },
  ];
  for (const s of sources) {
    await prisma.dataSource.upsert({
      where: { type_name: { type: s.type, name: s.name } },
      update: { endpoint: s.endpoint, frequencyMinutes: s.frequencyMinutes },
      create: { ...s, active: true },
    });
  }
  return sources.length;
}

async function seedTargets(d: Fixture) {
  // Sample targets — real values come from the SharePoint XLSX (step 5).
  const totalV27 = d.recs.reduce((s, r) => s + r.f, 0);
  const byBrand: Partial<Record<string, number>> = {};
  for (const r of d.recs) byBrand[r.m] = (byBrand[r.m] ?? 0) + r.f;

  // Global target: round up the snapshot total to the next R$ 500k step.
  const globalTarget = Math.ceil(totalV27 / 500_000) * 500_000;
  await prisma.target.upsert({
    where: {
      scope_scopeKey_period_unit: {
        scope: 'GLOBAL' as TargetScope,
        scopeKey: 'V27',
        period: 'V27',
        unit: 'BRL' as TargetUnit,
      },
    },
    update: { valueTarget: globalTarget, valueAchieved: totalV27 },
    create: {
      scope: 'GLOBAL',
      scopeKey: 'V27',
      period: 'V27',
      unit: 'BRL',
      valueTarget: globalTarget,
      valueAchieved: totalV27,
    },
  });

  let n = 1;
  for (const [label, achieved] of Object.entries(byBrand)) {
    const brand = mapBrand(label);
    const target = Math.ceil((achieved ?? 0) / 100_000) * 110_000; // +10 % stretch
    await prisma.target.upsert({
      where: {
        scope_scopeKey_period_unit: {
          scope: 'BRAND' as TargetScope,
          scopeKey: brand,
          period: 'V27',
          unit: 'BRL' as TargetUnit,
        },
      },
      update: { valueTarget: target, valueAchieved: achieved ?? 0, brand },
      create: {
        scope: 'BRAND',
        scopeKey: brand,
        period: 'V27',
        unit: 'BRL',
        valueTarget: target,
        valueAchieved: achieved ?? 0,
        brand,
      },
    });
    n++;
  }
  return n;
}

// =====================================================
// Main
// =====================================================

async function main() {
  console.log('▶ Seeding Painel V27');
  console.log(`  fixtures dir: ${FIXTURES_DIR}`);
  const t0 = Date.now();
  const { d, cp, v26m } = loadFixtures();
  console.log(`  fixtures: ${d.recs.length} records · ${Object.keys(cp).length} cities · ${Object.keys(v26m).length} v26 customers`);

  const users = await seedUsers();           console.log(`  ✓ users        ${users}`);
  const ufs = await seedUFs();               console.log(`  ✓ UFs          ${ufs}`);
  const cities = await seedCities(d, cp);    console.log(`  ✓ cities       ${cities}`);
  const reps = await seedReps(d);            console.log(`  ✓ reps         ${reps}`);
  const customers = await seedCustomers(d);  console.log(`  ✓ customers    ${customers}`);
  const products = await seedProducts(d);    console.log(`  ✓ products     ${products}`);
  const sales = await seedSales(d);          console.log(`  ✓ sales        ${sales}`);
  const v26 = await seedV26Baseline(v26m);   console.log(`  ✓ V26 baseline ${v26}`);
  const sources = await seedDataSources();   console.log(`  ✓ data sources ${sources}`);
  const targets = await seedTargets(d);      console.log(`  ✓ targets      ${targets}`);

  console.log(`\n✔ seed completed in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  console.log(`  default password for the 3 seed users: Catarina2026!`);
  console.log(`  rotate before production deploy (see README "Trocar senha inicial")\n`);
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
