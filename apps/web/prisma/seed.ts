// Seed for step 2 — three default users.
// Domain seed (UFs, cities, reps, SKUs, sales, targets) lands in step 3.
//
// IMPORTANT: change the default password (Catarina2026!) on the first
// production deploy. Documented in README.md > "Trocar senha inicial".

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Catarina2026!';
const DEFAULT_USERS = [
  {
    email: 'admin@catarina.local',
    name: 'Administrador',
    role: Role.ADMIN,
  },
  {
    email: 'gestor@catarina.local',
    name: 'Gestor Comercial',
    role: Role.GESTOR,
  },
  {
    email: 'analista@catarina.local',
    name: 'Analista de Mix',
    role: Role.ANALISTA,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const u of DEFAULT_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { ...u, passwordHash, active: true },
    });
    console.log(`seed: user ${u.email} (${u.role})`);
  }

  console.log(`seed: ${DEFAULT_USERS.length} users ready · default password "${DEFAULT_PASSWORD}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
