// @vitest-environment node
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { databaseUrl } from '@/lib/database-url';
import { formatDate, formatTime } from '@/lib/catalog';
afterEach(() => vi.unstubAllEnvs());
it('resolves relative SQLite paths from the application working directory', () => {
  expect(databaseUrl('file:./prisma/test.db')).toBe(`file:${resolve('prisma/test.db')}`);
});
it('preserves absolute SQLite paths', () => {
  expect(databaseUrl('file:/tmp/haven-test.db')).toBe('file:/tmp/haven-test.db');
});
it('uses the configured database or the local fallback', () => {
  vi.stubEnv('DATABASE_URL', 'file:./prisma/custom.db');
  expect(databaseUrl()).toBe(`file:${resolve('prisma/custom.db')}`);
  vi.stubEnv('DATABASE_URL', undefined);
  expect(databaseUrl()).toBe(`file:${resolve('prisma/dev.db')}`);
});
it.each(['postgres://host/db', 'https://host/db', 'sqlite:db', ''])('rejects non-file database URLs: %s', value => {
  expect(() => databaseUrl(value)).toThrow('DATABASE_URL must use a local SQLite file: URL.');
});
it('formats a UTC timestamp on the preceding São Paulo calendar day', () => {
  expect(formatDate('2026-10-26T01:00:00Z')).toBe('Oct 25');
  expect(formatTime('2026-10-26T01:00:00Z')).toBe('10:00 PM');
});
it('formats the daytime class schedule in São Paulo', () => {
  expect(formatTime('2026-10-25T17:00:00Z')).toBe('2:00 PM');
});
