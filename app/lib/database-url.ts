import { resolve } from 'node:path';

// Resolve relative SQLite paths from the application root for both CLI and runtime.
export function databaseUrl(url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db') {
  if (!url.startsWith('file:')) throw new Error('DATABASE_URL must use a local SQLite file: URL.');
  return `file:${resolve(url.slice(5))}`;
}
