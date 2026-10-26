// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client';
const mocks = vi.hoisted(() => ({ create: vi.fn().mockReturnValue({}), adapter: vi.fn().mockReturnValue(() => ({})) }));
vi.mock('better-auth', () => ({ betterAuth: mocks.create }));
vi.mock('@better-auth/prisma-adapter', () => ({ prismaAdapter: mocks.adapter }));
import { createAuth } from '@/lib/auth-config';
const db = {} as PrismaClient;
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('BETTER_AUTH_URL', 'https://school.example'); vi.stubEnv('BETTER_AUTH_SECRET', 'a-test-only-secret-with-at-least-32-characters'); });
afterEach(() => vi.unstubAllEnvs());
it.each([undefined, '', 'short-secret'])('refuses to initialize with an absent or short secret: %s', secret => {
  vi.stubEnv('BETTER_AUTH_SECRET', secret);
  expect(() => createAuth(db)).toThrow('Set BETTER_AUTH_SECRET');
  expect(mocks.adapter).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
});
it('refuses to initialize without the configured application origin', () => {
  vi.stubEnv('BETTER_AUTH_URL', undefined);
  expect(() => createAuth(db)).toThrow('Set BETTER_AUTH_URL'); expect(mocks.create).not.toHaveBeenCalled();
});
it('keeps public registration, browser role assignment, and cached session identity disabled', () => {
  createAuth(db);
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    baseURL: 'https://school.example',
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: { additionalFields: { role: { type: 'string', defaultValue: 'STUDENT', input: false } } },
    session: expect.objectContaining({ cookieCache: { enabled: false } }),
    rateLimit: { enabled: true },
  }));
});
