import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { db } from './db';
import { StudentInputError } from '../student-repository';

export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new StudentInputError('Please log in.', 401);
  // Always read current role from the database; never trust a client role or cached cookie.
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new StudentInputError('Please log in.', 401);
  return user;
}
export async function requireStudentId() {
  const user = await requireUser();
  if (user.role !== 'STUDENT') throw new StudentInputError('Student access required.', 403);
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) throw new StudentInputError('Student profile unavailable.', 403);
  return student.id;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new StudentInputError('Administrator access required.', 403);
  return user;
}
export async function requirePageUser(role?: 'STUDENT' | 'ADMIN') {
  try {
    const user = await requireUser();
    if (role && user.role !== role) redirect('/');
    return user;
  } catch (error) {
    if (error instanceof StudentInputError && error.status === 401) redirect('/login');
    throw error;
  }
}
