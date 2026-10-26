import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client';
import { classInput, materialsInput } from './class-input';
import { StudentInputError } from './student-repository';

export function courseRepository(db: PrismaClient) {
  return {
    async createClass(subjectId: string, body: Record<string, unknown>) {
      const data = classInput(body);
      const materials = materialsInput(body.materials) ?? [];
      if (materials.some(material => material.id)) throw new StudentInputError('New class materials cannot reuse existing IDs.');
      return db.$transaction(async tx => {
        if (!await tx.subject.findUnique({ where: { id: subjectId } })) throw new StudentInputError('Course not found.', 404);
        const lesson = await tx.class.create({ data: { ...data, id: randomUUID(), subjectId, materials: { create: materials.map(material => ({ ...material, id: randomUUID() })) } }, include: { materials: true } });
        return { id: lesson.id, materials: lesson.materials };
      });
    },
    async updateClass(subjectId: string, classId: string, body: Record<string, unknown>) {
      const data = classInput(body);
      const materials = materialsInput(body.materials);
      return db.$transaction(async tx => {
        const lesson = await tx.class.findFirst({ where: { id: classId, subjectId }, include: { materials: true } });
        if (!lesson) throw new StudentInputError('Class not found in this course.', 404);
        if (materials?.some(material => material.id && !lesson.materials.some(existing => existing.id === material.id))) throw new StudentInputError('Material does not belong to this class.', 400);
        await tx.class.update({ where: { id: classId }, data });
        if (materials !== undefined) {
          const retained: string[] = [];
          for (const material of materials) {
            const id = material.id ?? randomUUID();
            if (material.id) await tx.material.update({ where: { id }, data: { title: material.title, url: material.url } });
            else await tx.material.create({ data: { id, classId, title: material.title, url: material.url } });
            retained.push(id);
          }
          await tx.material.deleteMany({ where: { classId, id: { notIn: retained } } });
        }
        return { saved: true, materials: await tx.material.findMany({ where: { classId }, orderBy: { id: 'asc' } }) };
      });
    },
  };
}
