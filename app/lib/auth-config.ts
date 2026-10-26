import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { PrismaClient } from '../generated/prisma/client';

export function createAuth(db: PrismaClient) {
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.');
  }
  if (!process.env.BETTER_AUTH_URL) throw new Error('Set BETTER_AUTH_URL to the application origin.');
  return betterAuth({
    database: prismaAdapter(db, { provider: 'sqlite' }),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: { additionalFields: { role: { type: 'string', defaultValue: 'STUDENT', input: false } } },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    rateLimit: { enabled: true },
  });
}
