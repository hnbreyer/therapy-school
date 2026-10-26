import type { PrismaClient } from '../generated/prisma/client';
import type { StudentNote, StudentSnapshot } from './catalog';

export class StudentInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function noteDto(note: { id: string; classId: string; content: string; updatedAt: Date }): StudentNote {
  return { id: note.id, classId: note.classId, content: note.content, updatedAt: note.updatedAt.toISOString() };
}
function contentValue(content: unknown) {
  if (typeof content !== 'string' || !content.trim() || content.length > 10000) {
    throw new StudentInputError('Write a note between 1 and 10,000 characters.');
  }
  return content.trim();
}

// Identity is supplied by the server boundary, never by a browser payload.
export function studentRepository(db: PrismaClient, studentId: string) {
  async function requireClass(classId: string) {
    const lesson = await db.class.findUnique({ where: { id: classId } });
    if (!lesson) throw new StudentInputError('Class not found.', 404);
    return lesson;
  }
  return {
    async snapshot(): Promise<StudentSnapshot> {
      const [student, subjects, classes, notes, progress] = await db.$transaction([
        db.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, name: true } }),
        db.subject.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
        db.class.findMany({ include: { materials: { orderBy: { id: 'asc' } } }, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }] }),
        db.note.findMany({ where: { studentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
        db.classProgress.findMany({ where: { studentId, watched: true } }),
      ]);
      return { student, subjects, lessons: classes.map(lesson => ({ ...lesson, startsAt: lesson.startsAt.toISOString(), materials: lesson.materials.map(material => ({ title: material.title, url: material.url })) })), notes: notes.map(noteDto), watched: progress.map(item => item.classId) };
    },
    async createNote(classId: string, content: unknown) {
      const value = contentValue(content);
      await requireClass(classId);
      return noteDto(await db.note.create({ data: { studentId, classId, content: value } }));
    },
    async updateNote(classId: string, noteId: string, content: unknown) {
      const value = contentValue(content);
      return db.$transaction(async tx => {
        const result = await tx.note.updateMany({ where: { id: noteId, classId, studentId }, data: { content: value } });
        if (!result.count) throw new StudentInputError('Note not found.', 404);
        return noteDto(await tx.note.findUniqueOrThrow({ where: { id: noteId } }));
      });
    },
    async deleteNote(classId: string, noteId: string) {
      const result = await db.note.deleteMany({ where: { id: noteId, classId, studentId } });
      if (!result.count) throw new StudentInputError('Note not found.', 404);
    },
    async setWatched(classId: string, watched: unknown) {
      if (typeof watched !== 'boolean') throw new StudentInputError('Watched must be true or false.');
      const lesson = await requireClass(classId);
      if (watched && !lesson.recordingUrl) throw new StudentInputError('A recording is not available for this class yet.');
      await db.classProgress.upsert({ where: { studentId_classId: { studentId, classId } }, create: { studentId, classId, watched }, update: { watched } });
      return { classId, watched };
    },
  };
}
