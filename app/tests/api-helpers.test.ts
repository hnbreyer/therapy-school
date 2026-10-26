// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/db', () => ({ db: {} }));
vi.mock('@/lib/server/student', () => ({ requireStudentId: vi.fn() }));
import { jsonBody, requireOrigin, respond } from '@/lib/server/api';
import { StudentInputError } from '@/lib/student-repository';
beforeEach(() => vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000'));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function request(body: string) { return new Request('http://localhost:3000/api', { method: 'POST', body }); }
it('accepts a JSON object, including an empty one', async () => {
  expect(await jsonBody(request('{"content":"hello"}'))).toEqual({ content: 'hello' });
  expect(await jsonBody(request('{}'))).toEqual({});
});
it.each(['null', '[]', '"text"', '42', 'true', '{broken', ''])('rejects a non-object or malformed JSON body: %s', async body => {
  await expect(jsonBody(request(body))).rejects.toMatchObject({ status: 400 });
});
it('accepts the exact configured origin', () => {
  expect(() => requireOrigin(new Request('http://localhost:3000/api', { headers: { Origin: 'http://localhost:3000' } }))).not.toThrow();
});
it.each([undefined, 'null', 'http://127.0.0.1:3000', 'https://localhost:3000', 'http://localhost:3001', 'http://localhost:3000.evil.example'])('rejects a missing or mismatched origin: %s', origin => {
  const req = new Request('http://localhost:3000/api', { headers: origin ? { Origin: origin } : {} });
  expect(() => requireOrigin(req)).toThrow(StudentInputError);
});
it('returns JSON without shared caching after successful work', async () => {
  const result = await respond(async () => ({ saved: true }));
  expect(result.status).toBe(200);
  expect(result.headers.get('Cache-Control')).toBe('no-store');
  expect(await result.json()).toEqual({ saved: true });
});
it.each([400, 401, 403, 404])('preserves a controlled %s error response', async status => {
  const result = await respond(async () => { throw new StudentInputError('Controlled error', status); });
  expect(result.status).toBe(status);
  expect(await result.json()).toEqual({ error: 'Controlled error' });
});
it('does not disclose internal errors to the browser', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = await respond(async () => { throw new Error('secret connection details'); });
  expect(result.status).toBe(500);
  expect(await result.text()).not.toContain('secret connection details');
  expect(log).toHaveBeenCalled();
});
