// Session checks and redirects must finish before entering the protected space.
export const instant = false;
import { requirePageUser } from '@/lib/server/student';
import { db } from '@/lib/server/db';
import { ClassEditor, NewClassEditor } from '@/components/class-editor';
import { CourseEditor } from '@/components/course-editor';
export default async function Admin() {
  await requirePageUser('ADMIN');
  const subjects = await db.subject.findMany({ orderBy: { position: 'asc' }, include: { classes: { orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], include: { materials: true } } } });
  return <section><div className="page-heading"><div><span className="eyebrow">PROGRAMME SETTINGS</span><h1>Course management</h1><p>Edit your courses and their classes below.</p></div></div>{subjects.map(subject => <section className="managed-course panel" key={subject.id} aria-label={subject.title}><CourseEditor subject={subject} /><h3>Classes ({subject.classes.length})</h3><NewClassEditor subjectId={subject.id} /><div className="managed-classes">{subject.classes.map(lesson => <ClassEditor key={lesson.id} subjectId={subject.id} lesson={{ ...lesson, startsAt: lesson.startsAt.toISOString() }} />)}{!subject.classes.length && <p>No classes scheduled for this course.</p>}</div></section>)}</section>;
}
