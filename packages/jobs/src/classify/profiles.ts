// Profile classification — atribui CustomerProfile a cada cliente
// baseado em quantas coleções ele aparece e se ainda está ativo.
//
// Regras (mantém o enum CustomerProfile existente):
//   1. cliente está no ciclo atual (`current`):
//      ≥ 5 coleções → VIP_3PLUS
//      4 coleções   → VIP
//      3 coleções   → FREQUENTE
//      2 coleções   → REGULAR
//      1 coleção    → NOVO_27         (entrou agora)
//   2. cliente NÃO está no ciclo atual:
//      apareceu pela primeira vez no ciclo anterior → NOVO_25
//      caso contrário → REGULAR        (histórico inativo)
//
// "Atual" e "anterior" são detectados pelo `MAX(date)` por coleção,
// não por ordem alfabética — INVERNO_2026 e VERAO_2026 têm o mesmo
// ano de venda, a data manda.

import type { CustomerProfile, PrismaClient } from '@prisma/client';

export interface CustomerCollectionFootprint {
  customerId: string;
  collections: Set<string>;
}

export interface ClassifyOptions {
  /** Sobrescreve a coleção considerada "atual". */
  currentCollection?: string;
  /** Sobrescreve a coleção anterior (define quem é NOVO_25). */
  previousCollection?: string;
  /** Quando true, só calcula sem gravar. Útil pra inspecionar. */
  dryRun?: boolean;
}

export interface ClassifyResult {
  current: string | null;
  previous: string | null;
  totalCustomers: number;
  changed: number;
  byProfile: Record<CustomerProfile, number>;
}

const ZERO_BY_PROFILE: Record<CustomerProfile, number> = {
  VIP_3PLUS: 0,
  VIP: 0,
  FREQUENTE: 0,
  REGULAR: 0,
  NOVO_25: 0,
  NOVO_27: 0,
};

/** Pura — só lógica de regra, fácil de testar. */
export function classify(
  collections: Set<string>,
  current: string | null,
  previous: string | null,
): CustomerProfile {
  const inCurrent = current !== null && collections.has(current);
  const inPrevious = previous !== null && collections.has(previous);
  const count = collections.size;

  if (inCurrent) {
    if (count >= 5) return 'VIP_3PLUS';
    if (count === 4) return 'VIP';
    if (count === 3) return 'FREQUENTE';
    if (count === 2) return 'REGULAR';
    return 'NOVO_27';
  }
  // Cliente fora do ciclo atual. NOVO_25 ("entrou no ciclo anterior e
  // sumiu") só faz sentido quando há de fato um ciclo atual contra o
  // qual contrastar — caso contrário o label não tem âncora temporal.
  if (current !== null && inPrevious && count === 1) return 'NOVO_25';
  return 'REGULAR';
}

/** Detecta as duas coleções mais recentes pelo MAX(date) por coleção. */
export async function detectRecentCollections(
  db: PrismaClient,
): Promise<{ current: string | null; previous: string | null }> {
  const rows = await db.sale.groupBy({
    by: ['collection'],
    _max: { date: true },
  });
  const ordered = rows
    .filter((r) => r._max.date !== null)
    .sort((a, b) => (b._max.date! > a._max.date! ? 1 : -1))
    .map((r) => r.collection);
  return { current: ordered[0] ?? null, previous: ordered[1] ?? null };
}

export async function classifyProfiles(
  db: PrismaClient,
  opts: ClassifyOptions = {},
): Promise<ClassifyResult> {
  // 1. Determine which collections count as current / previous.
  let current = opts.currentCollection ?? null;
  let previous = opts.previousCollection ?? null;
  if (!current || !previous) {
    const detected = await detectRecentCollections(db);
    current = current ?? detected.current;
    previous = previous ?? detected.previous;
  }

  // 2. Read footprints — each customer's set of distinct collections.
  const rows = await db.sale.groupBy({
    by: ['customerId', 'collection'],
  });
  const footprints = new Map<string, Set<string>>();
  for (const r of rows) {
    let s = footprints.get(r.customerId);
    if (!s) {
      s = new Set();
      footprints.set(r.customerId, s);
    }
    s.add(r.collection);
  }

  // 3. Classify + persist (batched updates to avoid one-row-per-tx overhead).
  const byProfile = { ...ZERO_BY_PROFILE };
  let changed = 0;

  if (footprints.size === 0) {
    return { current, previous, totalCustomers: 0, changed: 0, byProfile };
  }

  // Pull current profiles to skip no-op updates.
  const existing = await db.customer.findMany({
    where: { id: { in: [...footprints.keys()] } },
    select: { id: true, profile: true },
  });
  const currentProfiles = new Map(existing.map((c) => [c.id, c.profile]));

  // Group customers by target profile so we can issue 6 updateMany calls
  // instead of N upserts. Massively faster on large historic loads.
  const groups: Record<CustomerProfile, string[]> = {
    VIP_3PLUS: [],
    VIP: [],
    FREQUENTE: [],
    REGULAR: [],
    NOVO_25: [],
    NOVO_27: [],
  };
  for (const [customerId, collections] of footprints) {
    const profile = classify(collections, current, previous);
    byProfile[profile]++;
    if (currentProfiles.get(customerId) !== profile) {
      groups[profile].push(customerId);
      changed++;
    }
  }

  if (!opts.dryRun) {
    for (const [profile, ids] of Object.entries(groups) as [CustomerProfile, string[]][]) {
      if (ids.length === 0) continue;
      // Chunk to avoid bloating a single IN (...) clause on huge histories.
      const CHUNK = 1000;
      for (let i = 0; i < ids.length; i += CHUNK) {
        await db.customer.updateMany({
          where: { id: { in: ids.slice(i, i + CHUNK) } },
          data: { profile },
        });
      }
    }
  }

  return { current, previous, totalCustomers: footprints.size, changed, byProfile };
}
