import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ClassEditor, NewClassEditor } from '@/components/class-editor';
const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('renders and submits the add-class form without an existing lesson', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'created-class', materials: [] }) });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  const { container } = render(<NewClassEditor subjectId="listening" />);
  await user.click(container.querySelector('summary')!);
  expect((screen.getByLabelText('Class title', { exact: true }) as HTMLInputElement).value).toBe('');
  await user.type(screen.getByLabelText('Class title', { exact: true }), 'New seminar');
  await user.type(screen.getByLabelText('Class description'), 'Seminar description');
  fireEvent.change(screen.getByLabelText('Start time (São Paulo, UTC−3)'), { target: { value: '2026-11-05T16:30' } });
  await user.click(screen.getByRole('button', { name: /^Add class$/ }));
  expect((await screen.findByRole('status')).textContent).toBe('Class added.');
  expect(fetch).toHaveBeenCalledWith('/api/admin/subjects/listening/classes', expect.objectContaining({ method: 'POST' }));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ title: 'New seminar', startsAt: '2026-11-05T19:30:00.000Z', duration: 90, materials: [] });
  expect(refresh).toHaveBeenCalled();
});
it('renders and submits an existing lesson in edit mode', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true, materials: [] }) });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  const { container } = render(<ClassEditor subjectId="listening" lesson={{ id: 'listening-1', title: 'Listening', description: 'Existing class', startsAt: '2026-11-05T19:30:00.000Z', duration: 90, recordingUrl: null, zoomUrl: null, materials: [] }} />);
  await user.click(container.querySelector('summary')!);
  expect((screen.getByLabelText('Class title', { exact: true }) as HTMLInputElement).value).toBe('Listening');
  await user.click(screen.getByRole('button', { name: /^Save class$/ }));
  expect((await screen.findByRole('status')).textContent).toBe('Class saved.');
  expect(fetch).toHaveBeenCalledWith('/api/admin/subjects/listening/classes/listening-1', expect.objectContaining({ method: 'PATCH' }));
});

it('handles creation props retained by an older open tab', () => {
  // @ts-expect-error Simulate the previous optional-lesson component contract.
  const { container } = render(<ClassEditor subjectId="listening" />);
  expect(container.querySelector('summary')?.textContent).toBe('Add class');
  expect((container.querySelector('input[name="title"]') as HTMLInputElement).value).toBe('');
});

it.each(['server', 'network'])('retains class and material drafts after a %s failure', async failure => {
  const fetch = failure === 'server'
    ? vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Invalid material URL.' }) })
    : vi.fn().mockRejectedValue(new Error('offline'));
  vi.stubGlobal('fetch', fetch); const user = userEvent.setup();
  const { container } = render(<ClassEditor subjectId="listening" lesson={{ id: 'class-1', title: 'Class', description: 'Description', startsAt: '2026-11-05T19:30:00.000Z', duration: 90, recordingUrl: null, zoomUrl: null, materials: [{ id: 'material-1', title: 'Guide', url: '/guide' }] }} />);
  await user.click(container.querySelector('summary')!);
  const title = screen.getByLabelText('Class title', { exact: true }) as HTMLInputElement;
  await user.clear(title); await user.type(title, 'Edited draft');
  await user.click(screen.getByRole('button', { name: 'Add material' }));
  await user.type(screen.getByLabelText('Material 2 title'), 'Reading');
  await user.type(screen.getByLabelText('Material 2 URL'), '/reading.pdf');
  await user.click(screen.getByRole('button', { name: 'Save class' }));
  expect(screen.getByRole('status').textContent).toBe(failure === 'server' ? 'Invalid material URL.' : 'Could not save class. Please try again.');
  expect(title.value).toBe('Edited draft');
  expect((screen.getByLabelText('Material 2 title') as HTMLInputElement).value).toBe('Reading');
  expect(JSON.parse(fetch.mock.calls[0][1].body).materials).toEqual([{ id: 'material-1', title: 'Guide', url: '/guide' }, { title: 'Reading', url: '/reading.pdf' }]);
  expect(refresh).not.toHaveBeenCalled();
});
it('removes a material from the submitted draft without submitting when the remove button is clicked', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true, materials: [] }) }); vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup(); const { container } = render(<ClassEditor subjectId="listening" lesson={{ id: 'class-1', title: 'Class', description: 'Description', startsAt: '2026-11-05T19:30:00.000Z', duration: 90, recordingUrl: null, zoomUrl: null, materials: [{ id: 'material-1', title: 'Guide', url: '/guide' }] }} />);
  await user.click(container.querySelector('summary')!);
  await user.click(screen.getByRole('button', { name: 'Remove material 1' }));
  expect(fetch).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Material 1 title')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save class' }));
  expect(JSON.parse(fetch.mock.calls[0][1].body).materials).toEqual([]);
});
