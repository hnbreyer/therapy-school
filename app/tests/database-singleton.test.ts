// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  constructor: class GeneratedClient {},
  create: vi.fn(() => ({ user: {}, session: {}, account: {}, verification: {} })),
}));
vi.mock('server-only', () => ({}));
vi.mock('../generated/prisma/client', () => ({ PrismaClient: mocks.constructor }));
vi.mock('../lib/database-client', () => ({ createDatabaseClient: mocks.create }));

const cache = globalThis as unknown as {
  database?: unknown;
  databaseConstructor?: unknown;
  databaseUrl?: string;
};
const previous = {
  database: cache.database,
  databaseConstructor: cache.databaseConstructor,
  databaseUrl: cache.databaseUrl,
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'file:./prisma/test.db');
  delete cache.database;
  delete cache.databaseConstructor;
  delete cache.databaseUrl;
});
afterEach(() => { Object.assign(cache, previous); vi.unstubAllEnvs(); });

it('replaces a pre-authentication client retained by hot reload', async () => {
  const legacy = { student: {}, note: {}, classProgress: {} };
  cache.database = legacy;
  const { db } = await import('../lib/server/db');
  expect(db).not.toBe(legacy);
  expect(db).toHaveProperty('user');
  expect(db).toHaveProperty('session');
  expect(db).toHaveProperty('account');
  expect(db).toHaveProperty('verification');
  expect(cache.database).toBe(db);
});
it('reuses the current client across normal hot reloads', async () => {
  const first = await import('../lib/server/db');
  vi.resetModules();
  const second = await import('../lib/server/db');
  expect(second.db).toBe(first.db);
  expect(mocks.create).toHaveBeenCalledTimes(1);
});
it('replaces the cached client after regeneration changes its constructor', async () => {
  const first = await import('../lib/server/db');
  cache.databaseConstructor = class PreviousGeneratedClient {};
  vi.resetModules();
  const second = await import('../lib/server/db');
  expect(second.db).not.toBe(first.db);
  expect(mocks.create).toHaveBeenCalledTimes(2);
});
it('replaces the cached client when DATABASE_URL changes', async () => {
  const first = await import('../lib/server/db');
  vi.stubEnv('DATABASE_URL', 'file:./prisma/other.db');
  vi.resetModules();
  const second = await import('../lib/server/db');
  expect(second.db).not.toBe(first.db);
  expect(mocks.create).toHaveBeenLastCalledWith('file:./prisma/other.db');
});
