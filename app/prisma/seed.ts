import 'dotenv/config';
import { createDatabaseClient } from '../lib/database-client';
import { seedDatabase } from './seed-data';

async function main() {
  const db = createDatabaseClient(process.env.DATABASE_URL ?? 'file:./prisma/dev.db');
  try {
    await seedDatabase(db);
    console.log('Seeded fictional catalogue and development student. Existing notes and progress were preserved.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
