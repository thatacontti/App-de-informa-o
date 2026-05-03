// One-shot reclassificação de CustomerProfile.
//
// Pra ser rodado depois da ingestão histórica (ou de qualquer batch
// novo de Sale), pra que VIP/FREQUENTE/REGULAR/NOVO* deixem de ser o
// default `NOVO_27` da migração.
//
// Uso:
//   pnpm --filter @painel/jobs run classify:profiles
//   pnpm --filter @painel/jobs run classify:profiles -- --dry
//   pnpm --filter @painel/jobs run classify:profiles -- --current=VERAO_2027_VERAO --previous=VERAO_2026_VERAO

import { PrismaClient } from '@prisma/client';
import { classifyProfiles, detectRecentCollections } from '../classify/profiles';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes('--dry');
  const currentCollection = readArg('current');
  const previousCollection = readArg('previous');

  const db = new PrismaClient();
  try {
    const detected = await detectRecentCollections(db);
    const used = {
      current: currentCollection ?? detected.current,
      previous: previousCollection ?? detected.previous,
    };
    console.log(`detected (most recent two by MAX(date)):`);
    console.log(`  current:  ${detected.current ?? '(none)'}`);
    console.log(`  previous: ${detected.previous ?? '(none)'}`);
    if (currentCollection || previousCollection) {
      console.log(`overrides applied → current=${used.current} · previous=${used.previous}`);
    }

    const t0 = Date.now();
    const r = await classifyProfiles(db, { currentCollection, previousCollection, dryRun });
    const ms = Date.now() - t0;

    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}clientes processados: ${r.totalCustomers}`);
    console.log(`atualizados: ${r.changed}`);
    console.log(`distribuição final:`);
    for (const [profile, count] of Object.entries(r.byProfile)) {
      const pct = r.totalCustomers ? ((count / r.totalCustomers) * 100).toFixed(1) : '0.0';
      console.log(`  ${profile.padEnd(11)} ${String(count).padStart(7)}  (${pct}%)`);
    }
    console.log(`\n✓ ${(ms / 1000).toFixed(1)}s`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
