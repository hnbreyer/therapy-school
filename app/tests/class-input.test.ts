// @vitest-environment node
import { expect, it } from 'vitest';
import { classInput } from '@/lib/class-input';
const valid = { title: 'Listening', description: 'A class description', startsAt: '2026-10-25T17:00:00.000Z', duration: 90, recordingUrl: 'https://example.org/recording', zoomUrl: '' };
it('accepts class edits and explicitly cleared optional links', () => {
  expect(classInput(valid)).toMatchObject({ title: 'Listening', startsAt: new Date(valid.startsAt), duration: 90, zoomUrl: null });
});
it.each([
  { title: ' ' }, { title: 'x'.repeat(201) }, { description: '' },
  { startsAt: 'not a date' }, { startsAt: '2026-10-25T17:00' },
  { duration: 0 }, { duration: 1441 }, { duration: 1.5 }, { duration: '90' },
  { recordingUrl: 'javascript:alert(1)' }, { zoomUrl: 'data:text/html,hello' },
  { recordingUrl: 'https://user:password@example.org/' },
])('rejects invalid class edits %j', change => {
  expect(() => classInput({ ...valid, ...change })).toThrow();
});
