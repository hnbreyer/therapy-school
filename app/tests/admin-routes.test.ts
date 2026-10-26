// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), update: vi.fn(), createClass: vi.fn(), updateClass: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/student', () => ({ requireAdmin: mocks.authorize, requireStudentId: vi.fn() }));
vi.mock('@/lib/server/db', () => ({ db: { subject: { updateMany: mocks.update } } }));
vi.mock('@/lib/course-repository', () => ({ courseRepository: () => ({ createClass: mocks.createClass, updateClass: mocks.updateClass }) }));
import { PATCH as course } from '@/app/api/admin/subjects/[subjectId]/route';
import { POST as createClass } from '@/app/api/admin/subjects/[subjectId]/classes/route';
import { PATCH as updateClass } from '@/app/api/admin/subjects/[subjectId]/classes/[classId]/route';
import { StudentInputError } from '@/lib/student-repository';
const params = Promise.resolve({ subjectId: 'trusted-course', classId: 'trusted-class' });
const valid = { title: ' Course ', teacher: ' Teacher ', description: ' Description ' };
const routes = [course, createClass, updateClass];
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
  mocks.authorize.mockResolvedValue({ role: 'ADMIN' });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.createClass.mockResolvedValue({ id: 'new-class', materials: [] });
  mocks.updateClass.mockResolvedValue({ saved: true, materials: [] });
});
afterEach(() => vi.unstubAllEnvs());
function request(data: unknown = valid, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
it.each(routes)('rejects unauthenticated and non-admin requests before any mutation (%#)', async route => {
  for (const status of [401, 403]) {
    mocks.authorize.mockRejectedValueOnce(new StudentInputError('Access denied', status));
    expect((await route(request(), { params })).status).toBe(status);
  }
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.createClass).not.toHaveBeenCalled();
  expect(mocks.updateClass).not.toHaveBeenCalled();
});
it.each(routes)('rejects cross-origin writes before mutation (%#)', async route => {
  expect((await route(request(valid, 'https://evil.example'), { params })).status).toBe(403);
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.createClass).not.toHaveBeenCalled();
  expect(mocks.updateClass).not.toHaveBeenCalled();
});
it.each(routes)('rejects malformed JSON before mutation (%#)', async route => {
  const malformed = new Request('http://localhost:3000/api', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: '{broken' });
  expect((await route(malformed, { params })).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.createClass).not.toHaveBeenCalled();
  expect(mocks.updateClass).not.toHaveBeenCalled();
});
it('trims course input and updates only allowed fields in the URL-selected course', async () => {
  const result = await course(request({ ...valid, id: 'forged-course', role: 'ADMIN', position: 99 }), { params });
  expect(result.status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'trusted-course' }, data: { title: 'Course', teacher: 'Teacher', description: 'Description' } });
});
it.each([{ title: '' }, { teacher: ' ' }, { description: 1 }, { title: 'x'.repeat(201) }, { teacher: 'x'.repeat(201) }, { description: 'x'.repeat(10001) }])('rejects invalid course fields %#', async invalid => {
  expect((await course(request({ ...valid, ...invalid }), { params })).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it('returns 404 when a course does not exist', async () => {
  mocks.update.mockResolvedValue({ count: 0 });
  expect((await course(request(), { params })).status).toBe(404);
});
it('passes trusted URL identifiers to the class repository', async () => {
  const data = { title: 'Class', subjectId: 'forged-course', id: 'forged-class' };
  await createClass(request(data), { params });
  expect(mocks.createClass).toHaveBeenCalledWith('trusted-course', data);
  await updateClass(request(data), { params });
  expect(mocks.updateClass).toHaveBeenCalledWith('trusted-course', 'trusted-class', data);
});
it('returns class validation and missing-class errors from the repository', async () => {
  mocks.createClass.mockRejectedValue(new StudentInputError('Invalid material', 400));
  mocks.updateClass.mockRejectedValue(new StudentInputError('Class not found', 404));
  expect((await createClass(request(), { params })).status).toBe(400);
  expect((await updateClass(request(), { params })).status).toBe(404);
});
