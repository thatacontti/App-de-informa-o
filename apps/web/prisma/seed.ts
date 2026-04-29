// Placeholder seed. Real seed (3 users, data sources, UFs, cities, reps,
// SKUs, sales) lands in step 3 once the full schema is in place.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.healthCheck.create({ data: { ok: true } });
  console.log('seed: scaffold healthcheck inserted');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
