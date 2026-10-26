// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createDatabaseClient } from '@/lib/database-client';
import { courseRepository } from '@/lib/course-repository';
import { seedDatabase } from '../prisma/seed-data';
let directory: string;
let db: ReturnType<typeof createDatabaseClient>;
const fields = { title: 'New class', description: 'Class description', startsAt: '2026-11-01T17:00:00.000Z', duration: 90, recordingUrl: '', zoomUrl: '' };
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'haven-course-test-'));
  const url = `file:${join(directory, 'test.db')}`;
  await writeFile(join(directory, 'test.db'), '');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  db = createDatabaseClient(url);
}, 30000);
beforeEach(async () => { await db.class.deleteMany(); await seedDatabase(db); });
afterAll(async () => { await db?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); });
it('creates a class and its materials in the selected course with server-generated IDs', async () => {
  const created = await courseRepository(db).createClass('listening', { ...fields, id: 'browser-id', materials: [{ title: 'Guide', url: '/materials/guide.pdf' }] });
  expect(created.id).not.toBe('browser-id');
  expect(await db.class.findUnique({ where: { id: created.id } })).toMatchObject({ title: 'New class', subjectId: 'listening' });
  expect(created.materials).toEqual([expect.objectContaining({ title: 'Guide', classId: created.id })]);
  await expect(courseRepository(db).createClass('missing', fields)).rejects.toMatchObject({ status: 404 });
});
it('adds, edits, removes and clears materials without changing student work', async () => {
  const classId = 'listening-1';
  const old = await db.material.findFirstOrThrow({ where: { classId } });
  const note = await db.note.create({ data: { studentId: 'dev-jamie', classId, content: 'Keep private note' } });
  await db.classProgress.upsert({ where: { studentId_classId: { studentId: 'dev-jamie', classId } }, create: { studentId: 'dev-jamie', classId, watched: true }, update: { watched: true } });
  const result = await courseRepository(db).updateClass('listening', classId, { ...fields, materials: [{ id: old.id, title: 'Updated guide', url: '/materials/updated.pdf' }, { title: 'Reading', url: 'https://example.org/reading' }] });
  expect(result.materials).toHaveLength(2);
  expect(result.materials).toContainEqual(expect.objectContaining({ id: old.id, title: 'Updated guide' }));
  await courseRepository(db).updateClass('listening', classId, { ...fields, materials: [{ id: old.id, title: 'Only guide', url: '/materials/guide.pdf' }] });
  expect(await db.material.count({ where: { classId } })).toBe(1);
  await courseRepository(db).updateClass('listening', classId, fields);
  expect(await db.material.count({ where: { classId } })).toBe(1);
  await courseRepository(db).updateClass('listening', classId, { ...fields, materials: [] });
  expect(await db.material.count({ where: { classId } })).toBe(0);
  expect(await db.note.findUnique({ where: { id: note.id } })).toEqual(note);
  expect(await db.classProgress.findUnique({ where: { studentId_classId: { studentId: 'dev-jamie', classId } } })).toMatchObject({ watched: true });
});
it('rejects foreign material IDs atomically and scopes class writes to their course', async () => {
  const foreign = await db.material.findFirstOrThrow({ where: { classId: 'foundations-1' } });
  const original = await db.class.findUniqueOrThrow({ where: { id: 'listening-1' }, include: { materials: true } });
  await expect(courseRepository(db).updateClass('listening', 'listening-1', { ...fields, materials: [{ id: foreign.id, title: 'Stolen', url: '/stolen' }] })).rejects.toMatchObject({ status: 400 });
  await expect(courseRepository(db).updateClass('foundations', 'listening-1', fields)).rejects.toMatchObject({ status: 404 });
  expect(await db.class.findUniqueOrThrow({ where: { id: 'listening-1' }, include: { materials: true } })).toEqual(original);
  expect(await db.material.findUnique({ where: { id: foreign.id } })).toEqual(foreign);
});
it.each(['javascript:alert(1)', '//evil.example/file', '/\\evil.example/file', 'data:text/html,hello', 'file:///private', 'https://user:pass@example.org'])('rejects unsafe material URL %s without creating a class', async url => {
  await expect(courseRepository(db).createClass('listening', { ...fields, materials: [{ title: 'Bad', url }] })).rejects.toMatchObject({ status: 400 });
  expect(await db.class.count()).toBe(9);
});
it('rejects incomplete and duplicate material entries', async () => {
  for (const materials of [[{ title: '', url: '/guide' }], [{ title: 'Guide', url: '' }], [{ id: 'same', title: 'One', url: '/1' }, { id: 'same', title: 'Two', url: '/2' }]]) {
    await expect(courseRepository(db).updateClass('listening', 'listening-1', { ...fields, materials })).rejects.toMatchObject({ status: 400 });
  }
});
