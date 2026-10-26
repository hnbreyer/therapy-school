import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { databaseUrl } from './database-url';
import { PrismaClient } from '../generated/prisma/client';

export function createDatabaseClient(url: string) {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl(url) }) });
}
