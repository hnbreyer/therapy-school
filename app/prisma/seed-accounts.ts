import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { createDatabaseClient } from '../lib/database-client';

const db = createDatabaseClient(process.env.DATABASE_URL ?? 'file:./prisma/dev.db');
async function main() {
  if (process.env.SEED_DEVELOPMENT_ACCOUNTS !== 'true') throw new Error('Set SEED_DEVELOPMENT_ACCOUNTS=true only for a fictional local database.');
  const password = await hashPassword('Haven-local-2026!');
  for (const [id, name, email, role, studentId] of [
    ['dev-jamie-user', 'Jamie Lewis', 'jamie@example.test', 'STUDENT', 'dev-jamie'],
    ['dev-robin-user', 'Robin Chen', 'robin@example.test', 'STUDENT', 'dev-robin'],
    ['dev-admin-user', 'Alex Morgan', 'admin@example.test', 'ADMIN', null],
  ] as const) {
    await db.$transaction(async tx => {
      await tx.user.upsert({ where: { id }, create: { id, name, email, role }, update: {} });
      await tx.account.upsert({ where: { providerId_accountId: { providerId: 'credential', accountId: id } }, create: { id: `${id}-credential`, userId: id, providerId: 'credential', accountId: id, password }, update: {} });
      if (studentId) {
        const existing = await tx.student.findUnique({ where: { id: studentId } });
        if (existing?.userId && existing.userId !== id) throw new Error('Refusing to reassign existing student data.');
        await tx.student.upsert({ where: { id: studentId }, create: { id: studentId, name, userId: id }, update: { userId: id } });
      }
    });
  }
  console.log('Fictional local accounts ready; existing passwords and student work preserved.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
