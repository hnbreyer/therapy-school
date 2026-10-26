import 'server-only';
import { connection } from 'next/server';
import { db } from './db';
import { requirePageUser, requireStudentId } from './student';
import { studentRepository } from '../student-repository';

export async function loadStudent() {
  // Database-backed student state must be read on each request, not prerendered.
  await connection();
  await requirePageUser('STUDENT');
  return studentRepository(db, await requireStudentId()).snapshot();
}
export async function loadClass(id: string) {
  await connection();
  await requirePageUser('STUDENT');
  await requireStudentId();
  const lesson = await db.class.findUnique({ where: { id }, include: { subject: true, materials: { orderBy: { id: 'asc' } } } });
  if (!lesson) return null;
  return { subject: lesson.subject, lesson: { ...lesson, startsAt: lesson.startsAt.toISOString(), materials: lesson.materials.map(material => ({ title: material.title, url: material.url })) } };
}
export async function loadSubject(id: string) {
  await connection();
  await requirePageUser('STUDENT');
  await requireStudentId();
  const subject = await db.subject.findUnique({ where: { id }, include: { classes: { include: { materials: true }, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }] } } });
  if (!subject) return null;
  return { subject, lessons: subject.classes.map(lesson => ({ ...lesson, startsAt: lesson.startsAt.toISOString(), materials: lesson.materials.map(material => ({ title: material.title, url: material.url })) })) };
}
