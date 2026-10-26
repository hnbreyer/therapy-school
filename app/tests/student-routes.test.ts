// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ identity: vi.fn(), repository: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), watched: vi.fn(), snapshot: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/server/student', () => ({ requireStudentId: mocks.identity }));
vi.mock('@/lib/server/db', () => ({ db: { marker: 'server-database' } }));
vi.mock('@/lib/student-repository', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/student-repository')>(), studentRepository: mocks.repository }));
import { POST } from '@/app/api/classes/[classId]/notes/route';
import { PATCH, DELETE } from '@/app/api/classes/[classId]/notes/[noteId]/route';
import { PUT } from '@/app/api/classes/[classId]/progress/route';
import { GET } from '@/app/api/student/route';
import { StudentInputError } from '@/lib/student-repository';
const context = { params: Promise.resolve({ classId: 'url-class', noteId: 'url-note' }) };
const operations = [
  { name: 'create note', call: (request: Request) => POST(request, context), mock: mocks.create, args: ['url-class', 'Content'] },
  { name: 'edit note', call: (request: Request) => PATCH(request, context), mock: mocks.update, args: ['url-class', 'url-note', 'Content'] },
  { name: 'delete note', call: (request: Request) => DELETE(request, context), mock: mocks.remove, args: ['url-class', 'url-note'] },
  { name: 'set watched', call: (request: Request) => PUT(request, context), mock: mocks.watched, args: ['url-class', true] },
];
function request(origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ content: 'Content', watched: true, studentId: 'forged-student', classId: 'forged-class', noteId: 'forged-note' }) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
  mocks.identity.mockResolvedValue('verified-student');
  mocks.create.mockResolvedValue({ id: 'saved-note' }); mocks.update.mockResolvedValue({ id: 'url-note' }); mocks.remove.mockResolvedValue(undefined); mocks.watched.mockResolvedValue({ watched: true }); mocks.snapshot.mockResolvedValue({ notes: [], watched: [] });
  mocks.repository.mockReturnValue({ createNote: mocks.create, updateNote: mocks.update, deleteNote: mocks.remove, setWatched: mocks.watched, snapshot: mocks.snapshot });
});
afterEach(() => vi.unstubAllEnvs());
it.each(operations)('$name uses session identity and URL identifiers, ignoring forged browser identifiers', async operation => {
  expect((await operation.call(request())).status).toBe(200);
  expect(mocks.repository).toHaveBeenCalledWith({ marker: 'server-database' }, 'verified-student');
  expect(operation.mock).toHaveBeenCalledWith(...operation.args);
});
it.each(operations)('$name denies unsigned-in users and incorrect roles before constructing a repository', async operation => {
  for (const status of [401, 403]) {
    mocks.identity.mockRejectedValueOnce(new StudentInputError('Access denied', status));
    expect((await operation.call(request())).status).toBe(status);
  }
  expect(mocks.repository).not.toHaveBeenCalled();
});
it.each(operations)('$name refuses cross-origin mutations', async operation => {
  expect((await operation.call(request('https://evil.example'))).status).toBe(403);
  expect(operation.mock).not.toHaveBeenCalled();
});
it('loads the private snapshot through the verified repository', async () => {
  const response = await GET();
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ notes: [], watched: [] });
  expect(mocks.repository).toHaveBeenCalledWith({ marker: 'server-database' }, 'verified-student');
});
it('does not load a private snapshot without a student session', async () => {
  mocks.identity.mockRejectedValue(new StudentInputError('Please log in', 401));
  expect((await GET()).status).toBe(401); expect(mocks.snapshot).not.toHaveBeenCalled();
});
it('preserves the ownership-safe 404 on a note owned by someone else', async () => {
  mocks.update.mockRejectedValue(new StudentInputError('Note not found.', 404));
  const response = await PATCH(request(), context);
  expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: 'Note not found.' });
});
