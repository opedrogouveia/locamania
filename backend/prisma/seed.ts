import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

import { seedReferenceData } from './reference-data';

/**
 * Seed base (qualquer ambiente, produção inclusive): dados de referência +
 * a conta da proprietária. Idempotente — pode rodar de novo sem estragar nada.
 *
 * Para dados de demonstração (frota, clientes, 12 meses de operação), use
 * `pnpm --filter @locamania/backend db:seed:demo`.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedReferenceData(prisma);

  const password = process.env.SEED_PASSWORD ?? 'changeme123';
  const email = (process.env.SEED_OWNER_EMAIL ?? 'proprietaria@locamania.local').toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: process.env.SEED_OWNER_NAME ?? 'Proprietária',
        email,
        role: 'OWNER',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
    console.log(`Conta da proprietária criada: ${email}`);
  }
  console.log('Dados de referência prontos.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
