import 'server-only';
import { PrismaClient } from '../../generated/prisma/client';
import { createDatabaseClient } from '../database-client';

const globalDatabase = globalThis as unknown as {
  database?: ReturnType<typeof createDatabaseClient>;
  databaseConstructor?: typeof PrismaClient;
  databaseUrl?: string;
};
const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
// Hot reload retains globalThis even after Prisma is regenerated. Only reuse a
// client created by this generated constructor and for this database URL.
const reusable = globalDatabase.databaseConstructor === PrismaClient && globalDatabase.databaseUrl === url;
export const db = (reusable && globalDatabase.database) || createDatabaseClient(url);
if (process.env.NODE_ENV !== 'production') {
  globalDatabase.database = db;
  globalDatabase.databaseConstructor = PrismaClient;
  globalDatabase.databaseUrl = url;
}
