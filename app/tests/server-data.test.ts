// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ connection: vi.fn(), page: vi.fn(), identity: vi.fn(), lesson: vi.fn(), subject: vi.fn(), snapshot: vi.fn(), repository: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ connection: mocks.connection }));
vi.mock('@/lib/server/student', () => ({ requirePageUser: mocks.page, requireStudentId: mocks.identity }));
vi.mock('@/lib/server/db', () => ({ db: { class: { findUnique: mocks.lesson }, subject: { findUnique: mocks.subject } } }));
vi.mock('@/lib/student-repository', () => ({ studentRepository: mocks.repository }));
import { loadClass, loadStudent, loadSubject } from '@/lib/server/data';
const lesson = { id: 'class-1', startsAt: new Date('2026-10-25T17:00:00Z'), materials: [{ id: 'material-1', title: 'Guide', url: '/guide.txt', classId: 'class-1' }] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.mockResolvedValue(undefined); mocks.page.mockResolvedValue({ role: 'STUDENT' });
  mocks.identity.mockResolvedValue('verified-student');
  mocks.repository.mockReturnValue({ snapshot: mocks.snapshot });
  mocks.snapshot.mockResolvedValue({ notes: [], watched: [] });
  mocks.lesson.mockResolvedValue({ ...lesson, subject: { id: 'subject-1' } });
  mocks.subject.mockResolvedValue({ id: 'subject-1', classes: [lesson] });
});
it('loads private state using the verified student identity', async () => {
  expect(await loadStudent()).toEqual({ notes: [], watched: [] });
  expect(mocks.connection).toHaveBeenCalled();
  expect(mocks.page).toHaveBeenCalledWith('STUDENT');
  expect(mocks.repository).toHaveBeenCalledWith(expect.anything(), 'verified-student');
});
it.each([loadStudent, () => loadClass('class-1'), () => loadSubject('subject-1')])('checks page access before reading catalogue or private data (%#)', async load => {
  const denied = new Error('redirect:/login');
  mocks.page.mockRejectedValue(denied);
  await expect(load()).rejects.toBe(denied);
  expect(mocks.repository).not.toHaveBeenCalled(); expect(mocks.lesson).not.toHaveBeenCalled(); expect(mocks.subject).not.toHaveBeenCalled();
});
it('requires a linked student before returning class data', async () => {
  mocks.identity.mockRejectedValue(new Error('No linked student'));
  await expect(loadClass('class-1')).rejects.toThrow('No linked student');
  expect(mocks.lesson).not.toHaveBeenCalled();
});
it('serializes a class date and material links for the browser', async () => {
  expect(await loadClass('class-1')).toMatchObject({ subject: { id: 'subject-1' }, lesson: { startsAt: '2026-10-25T17:00:00.000Z', materials: [{ title: 'Guide', url: '/guide.txt' }] } });
});
it('serializes the lessons belonging to a subject', async () => {
  expect(await loadSubject('subject-1')).toMatchObject({ subject: { id: 'subject-1' }, lessons: [{ startsAt: '2026-10-25T17:00:00.000Z', materials: [{ title: 'Guide', url: '/guide.txt' }] }] });
});
it('returns null for a missing class or subject', async () => {
  mocks.lesson.mockResolvedValue(null); mocks.subject.mockResolvedValue(null);
  expect(await loadClass('missing')).toBeNull(); expect(await loadSubject('missing')).toBeNull();
});
