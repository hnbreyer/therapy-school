// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), student: vi.fn(), headers: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/server/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('@/lib/server/db', () => ({ db: { user: { findUnique: mocks.user }, student: { findUnique: mocks.student } } }));
import { requireAdmin, requirePageUser, requireStudentId, requireUser } from '@/lib/server/student';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers({ cookie: 'verified-by-library' }));
  mocks.session.mockResolvedValue({ user: { id: 'account-1', role: 'ADMIN' } });
  mocks.user.mockResolvedValue({ id: 'account-1', name: 'Robin', role: 'STUDENT' });
  mocks.student.mockResolvedValue({ id: 'student-1', userId: 'account-1' });
});
it('rejects an absent session before looking up an identity', async () => {
  mocks.session.mockResolvedValue(null);
  await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  expect(mocks.user).not.toHaveBeenCalled();
});
it('rejects a session whose account has been deleted', async () => {
  mocks.user.mockResolvedValue(null);
  await expect(requireUser()).rejects.toMatchObject({ status: 401 });
});
it('reads the current account rather than trusting the role in the session', async () => {
  expect(await requireUser()).toMatchObject({ role: 'STUDENT' });
  expect(mocks.session).toHaveBeenCalledWith({ headers: await mocks.headers() });
  expect(mocks.user).toHaveBeenCalledWith({ where: { id: 'account-1' } });
  await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
});
it('resolves a student only through the verified account link', async () => {
  expect(await requireStudentId()).toBe('student-1');
  expect(mocks.student).toHaveBeenCalledWith({ where: { userId: 'account-1' } });
});
it('rejects a student account without a linked profile', async () => {
  mocks.student.mockResolvedValue(null);
  await expect(requireStudentId()).rejects.toMatchObject({ status: 403 });
});
it('does not give an administrator access to a student profile', async () => {
  mocks.user.mockResolvedValue({ id: 'account-1', role: 'ADMIN' });
  await expect(requireStudentId()).rejects.toMatchObject({ status: 403 });
  expect(mocks.student).not.toHaveBeenCalled();
  expect(await requireAdmin()).toMatchObject({ role: 'ADMIN' });
});
it.each(['STUDENT', 'ADMIN'] as const)('allows authenticated %s users onto the shared home page', async role => {
  mocks.user.mockResolvedValue({ id: 'account-1', role });
  expect(await requirePageUser()).toMatchObject({ role });
});
it('redirects an anonymous page request to login', async () => {
  mocks.session.mockResolvedValue(null);
  await expect(requirePageUser()).rejects.toThrow('redirect:/login');
});
it.each([['STUDENT', 'ADMIN'], ['ADMIN', 'STUDENT']] as const)('redirects %s away from a %s-only page', async (role, required) => {
  mocks.user.mockResolvedValue({ id: 'account-1', role });
  await expect(requirePageUser(required)).rejects.toThrow('redirect:/');
});
it('does not misreport a database failure as an anonymous session', async () => {
  const error = new Error('Database unavailable');
  mocks.user.mockRejectedValue(error);
  await expect(requirePageUser()).rejects.toBe(error);
  expect(mocks.redirect).not.toHaveBeenCalled();
});
