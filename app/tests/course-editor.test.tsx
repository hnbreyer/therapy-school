import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CourseEditor } from '@/components/course-editor';
const subject = { id: 'listening', title: 'Listening', teacher: 'Teacher', description: 'Course description' };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('submits the edited course values and shows confirmed success', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup(); render(<CourseEditor subject={subject} />);
  await user.clear(screen.getByLabelText('Teacher')); await user.type(screen.getByLabelText('Teacher'), 'New teacher');
  await user.click(screen.getByRole('button', { name: 'Save course' }));
  expect(screen.getByRole('status').textContent).toBe('Course saved.');
  expect(fetch).toHaveBeenCalledWith('/api/admin/subjects/listening', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: 'Listening', teacher: 'New teacher', description: 'Course description' }) }));
});
it.each(['server', 'network'])('keeps the edited course draft on a %s failure', async failure => {
  const fetch = failure === 'server' ? vi.fn().mockResolvedValue({ ok: false }) : vi.fn().mockRejectedValue(new Error('offline'));
  vi.stubGlobal('fetch', fetch); const user = userEvent.setup(); render(<CourseEditor subject={subject} />);
  const title = screen.getByLabelText('Title') as HTMLInputElement;
  await user.clear(title); await user.type(title, 'Unsaved title'); await user.click(screen.getByRole('button', { name: 'Save course' }));
  expect(title.value).toBe('Unsaved title'); expect(screen.getByRole('status').textContent).toBe('Could not save course.');
});
