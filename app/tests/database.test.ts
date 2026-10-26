// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '@/lib/database-client';
import { studentRepository } from '@/lib/student-repository';
import { seedDatabase } from '../prisma/seed-data';

let directory: string;
let url: string;
let db: ReturnType<typeof createDatabaseClient>;
const studentId = 'dev-jamie';
const classId = 'listening-1';

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'haven-sqlite-test-'));
  url = `file:${join(directory, 'test.db')}`;
  await writeFile(join(directory, 'test.db'), '');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
  });
  db = createDatabaseClient(url);
  await seedDatabase(db);
  await db.student.create({ data: { id: 'another-student', name: 'Fictional second student' } });
}, 30000);

beforeEach(async () => {
  await db.note.deleteMany();
  await db.classProgress.deleteMany();
});
afterAll(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('SQLite persistence through Prisma', () => {
  it('creates, edits and deletes class notes across fresh connections', async () => {
    const notes = studentRepository(db, studentId);
    const note = await notes.createNote(classId, 'First reflection');
    const separateClient = createDatabaseClient(url);
    try {
      const reloaded = studentRepository(separateClient, studentId);
      expect((await reloaded.snapshot()).notes).toEqual([expect.objectContaining({ id: note.id, content: 'First reflection' })]);
      await reloaded.updateNote(classId, note.id, 'Edited reflection');
      expect((await notes.snapshot()).notes[0].content).toBe('Edited reflection');
      await notes.deleteNote(classId, note.id);
      expect((await reloaded.snapshot()).notes).toEqual([]);
    } finally { await separateClient.$disconnect(); }
  });

  it('keeps multiple notes associated with their individual classes', async () => {
    const repository = studentRepository(db, studentId);
    await repository.createNote(classId, 'One');
    await repository.createNote(classId, 'Two');
    await repository.createNote('foundations-1', 'Another class');
    const snapshot = await repository.snapshot();
    expect(snapshot.notes.filter(note => note.classId === classId)).toHaveLength(2);
    expect(snapshot.notes.filter(note => note.classId === 'foundations-1')).toHaveLength(1);
  });

  it('scopes note reads, updates and deletes to student and class', async () => {
    const owner = studentRepository(db, studentId);
    const other = studentRepository(db, 'another-student');
    const note = await owner.createNote(classId, 'Owner’s note');
    expect((await other.snapshot()).notes).toEqual([]);
    await expect(other.updateNote(classId, note.id, 'Not allowed')).rejects.toMatchObject({ status: 404 });
    await expect(other.deleteNote(classId, note.id)).rejects.toMatchObject({ status: 404 });
    await expect(owner.updateNote('foundations-1', note.id, 'Wrong class')).rejects.toMatchObject({ status: 404 });
    await expect(owner.deleteNote('foundations-1', note.id)).rejects.toMatchObject({ status: 404 });
    expect((await owner.snapshot()).notes[0].content).toBe('Owner’s note');
  });

  it('persists idempotent watched updates and unwatched status per student', async () => {
    const owner = studentRepository(db, studentId);
    await owner.setWatched(classId, true);
    await owner.setWatched(classId, true);
    expect(await db.classProgress.count()).toBe(1);
    const separateClient = createDatabaseClient(url);
    try {
      const reloaded = studentRepository(separateClient, studentId);
      expect((await reloaded.snapshot()).watched).toEqual([classId]);
      expect((await studentRepository(separateClient, 'another-student').snapshot()).watched).toEqual([]);
      await reloaded.setWatched(classId, false);
      expect((await owner.snapshot()).watched).toEqual([]);
    } finally { await separateClient.$disconnect(); }
  });

  it('rejects invalid notes, unknown classes and invalid progress without creating records', async () => {
    const repository = studentRepository(db, studentId);
    for (const content of ['', '   ', 42, 'x'.repeat(10001)]) {
      await expect(repository.createNote(classId, content)).rejects.toMatchObject({ status: 400 });
    }
    await expect(repository.createNote('missing', 'A note')).rejects.toMatchObject({ status: 404 });
    await expect(repository.setWatched('missing', true)).rejects.toMatchObject({ status: 404 });
    await expect(repository.setWatched(classId, 'true')).rejects.toMatchObject({ status: 400 });
    await expect(repository.setWatched('listening-3', true)).rejects.toMatchObject({ status: 400 });
    expect(await db.note.count()).toBe(0);
    expect(await db.classProgress.count()).toBe(0);
  });

  it('reruns fictional seeds without replacing notes or existing progress', async () => {
    const repository = studentRepository(db, studentId);
    await repository.createNote(classId, 'Keep this reflection');
    await repository.setWatched(classId, false);
    await seedDatabase(db);
    await seedDatabase(db);
    const snapshot = await repository.snapshot();
    expect(snapshot.notes[0].content).toBe('Keep this reflection');
    expect(snapshot.watched).not.toContain(classId);
    expect(snapshot.subjects).toHaveLength(3);
    expect(snapshot.lessons).toHaveLength(9);
    expect(snapshot.lessons.every(lesson => lesson.materials.length > 0)).toBe(true);
    const times = snapshot.lessons.map(lesson => lesson.startsAt);
    expect(times).toEqual([...times].sort());
  });
});


it('preserves pre-authentication students, notes and progress when upgrading', () => {
  execFileSync(process.execPath, ['-e', `
    const { DatabaseSync } = require('node:sqlite');
    const { readFileSync } = require('node:fs');
    const assert = require('node:assert/strict');
    const legacy = new DatabaseSync(':memory:');
    legacy.exec(readFileSync('prisma/migrations/20261025180000_init/migration.sql', 'utf8'));
    legacy.exec("INSERT INTO Student VALUES ('legacy', 'Legacy Student'); INSERT INTO Subject VALUES ('subject', 'Title', 'Category', 'Description', 'Teacher', 'color', 'symbol', 0);");
    legacy.exec("INSERT INTO Class (id, subjectId, title, startsAt, duration, description) VALUES ('class', 'subject', 'Class', 0, 60, 'Description'); INSERT INTO Note (id, studentId, classId, content, updatedAt) VALUES ('note', 'legacy', 'class', 'Keep me', 0); INSERT INTO ClassProgress VALUES ('legacy', 'class', 1, 0);");
    legacy.exec(readFileSync('prisma/migrations/20261025200000_auth/migration.sql', 'utf8'));
    assert.equal(legacy.prepare('SELECT content FROM Note').get().content, 'Keep me');
    assert.equal(legacy.prepare('SELECT watched FROM ClassProgress').get().watched, 1);
    assert.equal(legacy.prepare('SELECT userId FROM Student').get().userId, null);
    assert.deepEqual(legacy.prepare('PRAGMA foreign_key_check').all(), []);
    legacy.close();
  `], { cwd: process.cwd(), stdio: 'pipe' });
});
