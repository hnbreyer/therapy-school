import { afterEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentProvider } from '@/components/student-state';
import { ClassDetail } from '@/components/class-detail';
import type { StudentSnapshot } from '@/lib/catalog';
import { subjects, lessons } from '../prisma/fixtures';

const initial: StudentSnapshot = { student: { id: 'dev-jamie', name: 'Jamie Lewis' }, subjects, lessons, watched: [], notes: [] };
const lesson = lessons.find(item => item.id === 'listening-1')!;
const subject = subjects.find(item => item.id === 'listening')!;
function ui() { return <StudentProvider initial={initial}><ClassDetail lesson={lesson} subject={subject}/></StudentProvider>; }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function response(value: unknown, ok = true) { return { ok, json: async () => value }; }

it('hydrates an editable note form and only reports saved after the server succeeds', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ id: 'note-1', classId: lesson.id, content: 'A reflection', updatedAt: new Date().toISOString() }));
  vi.stubGlobal('fetch', fetch);
  const container = document.createElement('div');
  container.innerHTML = renderToString(ui());
  document.body.append(container);
  expect((container.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(false);
  render(ui(), { container, hydrate: true });
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /new note for/i }), 'A reflection');
  await user.click(screen.getByRole('button', { name: 'Add note' }));
  expect(fetch).toHaveBeenCalledWith(`/api/classes/${lesson.id}/notes`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ content: 'A reflection' }) }));
  expect(screen.getByRole('status', { name: 'New note status' }).textContent).toContain('saved to the database');
  expect(screen.getByRole('article', { name: 'Saved class note' }).textContent).toContain('A reflection');
});

it('retains an unsaved draft and shows a server write failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Database unavailable' }, false)));
  render(ui());
  const user = userEvent.setup();
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  await user.type(field, 'Keep my draft');
  await user.click(screen.getByRole('button', { name: 'Add note' }));
  expect(field.value).toBe('Keep my draft');
  expect(screen.getByRole('status', { name: 'New note status' }).textContent).toBe('Database unavailable');
  expect(screen.queryByRole('article')).toBeNull();
});

it('edits and deletes a saved note through the API', async () => {
  const note = { id: 'note-1', classId: lesson.id, content: 'Original', updatedAt: new Date().toISOString() };
  const fetch = vi.fn().mockResolvedValueOnce(response({ ...note, content: 'Edited' })).mockResolvedValueOnce(response({ deleted: true }));
  vi.stubGlobal('fetch', fetch);
  render(<StudentProvider initial={{ ...initial, notes: [note] }}><ClassDetail lesson={lesson} subject={subject}/></StudentProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Edit note' }));
  const edit = screen.getByRole('textbox', { name: 'Edit note' });
  await user.clear(edit);
  await user.type(edit, 'Edited');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(within(screen.getByRole('article')).getByText('Edited')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Delete note' }));
  expect(screen.queryByRole('article')).toBeNull();
  expect(fetch.mock.calls.map(call => call[1].method)).toEqual(['PATCH', 'DELETE']);
});

it('saves watched status and leaves progress unchanged on a failed request', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ classId: lesson.id, watched: true })).mockResolvedValueOnce(response({ error: 'Try again' }, false));
  vi.stubGlobal('fetch', fetch);
  render(ui());
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /mark class as watched/i }));
  const button = screen.getByRole('button', { name: /mark as unwatched/i });
  expect(button.getAttribute('aria-pressed')).toBe('true');
  await user.click(button);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('status', { name: 'Progress status' }).textContent).toBe('Try again');
});

it('keeps the edit draft when saving an existing note fails', async () => {
  const note = { id: 'note-1', classId: lesson.id, content: 'Original', updatedAt: new Date().toISOString() };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Save failed' }, false)));
  render(<StudentProvider initial={{ ...initial, notes: [note] }}><ClassDetail lesson={lesson} subject={subject}/></StudentProvider>);
  const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Edit note' }));
  const field = screen.getByRole('textbox', { name: 'Edit note' }) as HTMLTextAreaElement;
  await user.clear(field); await user.type(field, 'Unsaved edit'); await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(field.value).toBe('Unsaved edit'); expect(screen.getByRole('article').textContent).toContain('Save failed');
});
it('keeps a saved note visible when deletion fails', async () => {
  const note = { id: 'note-1', classId: lesson.id, content: 'Keep original', updatedAt: new Date().toISOString() };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Delete failed' }, false)));
  render(<StudentProvider initial={{ ...initial, notes: [note] }}><ClassDetail lesson={lesson} subject={subject}/></StudentProvider>);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete note' }));
  expect(screen.getByRole('article').textContent).toContain('Keep original');
  expect(screen.getByRole('article').textContent).toContain('Delete failed');
});
