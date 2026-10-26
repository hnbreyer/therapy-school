import { StudentInputError } from './student-repository';

export function classInput(body: Record<string, unknown>) {
  function text(key: string, max: number) {
    const value = body[key];
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new StudentInputError(`Invalid ${key}.`);
    return value.trim();
  }
  function link(key: string) {
    const value = body[key];
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || value.length > 2048) throw new StudentInputError(`Invalid ${key}.`);
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
      return url.href;
    } catch { throw new StudentInputError(`Use an HTTP or HTTPS URL for ${key}.`); }
  }
  const title = text('title', 200);
  const description = text('description', 10000);
  const startsAt = new Date(typeof body.startsAt === 'string' ? body.startsAt : '');
  if (!Number.isFinite(startsAt.getTime()) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(String(body.startsAt))) throw new StudentInputError('Invalid class start time.');
  const duration = body.duration;
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 1440) throw new StudentInputError('Duration must be between 1 and 1440 minutes.');
  return { title, description, startsAt, duration, recordingUrl: link('recordingUrl'), zoomUrl: link('zoomUrl') };
}

export function materialsInput(value: unknown): { id?: string; title: string; url: string }[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 50) throw new StudentInputError('Use up to 50 class materials.');
  const ids = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new StudentInputError('Invalid class material.');
    const { id, title, url } = item;
    if (id !== undefined && (typeof id !== 'string' || !id || ids.has(id))) throw new StudentInputError('Invalid or duplicate material ID.');
    if (id) ids.add(id);
    if (typeof title !== 'string' || !title.trim() || title.length > 200 || typeof url !== 'string' || !url.trim() || url.length > 2048) throw new StudentInputError('Each material needs a title and a valid URL.');
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed, 'https://materials.invalid');
      const relative = trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\');
      if ((!relative && !/^https?:\/\//i.test(trimmed)) || !['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || (relative && parsed.origin !== 'https://materials.invalid')) throw new Error();
    } catch { throw new StudentInputError('Material URLs must use HTTP, HTTPS, or a local path starting with /.'); }
    return { ...(id ? { id } : {}), title: title.trim(), url: trimmed };
  });
}
