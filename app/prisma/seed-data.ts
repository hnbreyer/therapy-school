import type { PrismaClient } from '../generated/prisma/client';
import { subjects, lessons, initialWatched } from './fixtures';

// Idempotent: refreshing the fictional catalogue never erases student work.
export async function seedDatabase(db: PrismaClient) {
  await db.$transaction(async tx => {
    await tx.student.upsert({ where: { id: 'dev-jamie' }, create: { id: 'dev-jamie', name: 'Jamie Lewis' }, update: {} });
    for (const [position, subject] of subjects.entries()) {
      await tx.subject.upsert({ where: { id: subject.id }, create: { ...subject, position }, update: { ...subject, position } });
    }
    for (const lesson of lessons) {
      const { materials, ...fields } = lesson;
      const data = { ...fields, startsAt: new Date(fields.startsAt) };
      await tx.class.upsert({ where: { id: lesson.id }, create: data, update: data });
      for (const [index, material] of materials.entries()) {
        const id = `${lesson.id}-material-${index}`;
        await tx.material.upsert({ where: { id }, create: { id, classId: lesson.id, ...material }, update: material });
      }
    }
    for (const classId of initialWatched) {
      await tx.classProgress.upsert({ where: { studentId_classId: { studentId: 'dev-jamie', classId } }, create: { studentId: 'dev-jamie', classId, watched: true }, update: {} });
    }
  });
}
