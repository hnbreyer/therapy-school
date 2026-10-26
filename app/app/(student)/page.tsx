// This page waits for verified session identity before rendering.
export const instant = false;
import Link from 'next/link';
import { Dashboard } from '@/components/learning';
import { requirePageUser } from '@/lib/server/student';
import { db } from '@/lib/server/db';
export default async function Home() {
  const user = await requirePageUser();
  if (user.role !== 'ADMIN') return <Dashboard />;
  const subjects = await db.subject.findMany({ orderBy: { position: 'asc' }, include: { _count: { select: { classes: true } } } });
  const classCount = subjects.reduce((total, subject) => total + subject._count.classes, 0);
  return <>
    <div className="page-heading"><div><span className="eyebrow">YOUR SCHOOL AT A GLANCE</span><h1>Welcome back, {user.name.split(' ')[0]}</h1><p>Explore your programme and keep your courses up to date.</p></div></div>
    <section className="stats" aria-label="Programme overview"><div><span className="stat-icon sage">▤</span><div><strong>{subjects.length}<small>Active subjects</small></strong></div></div><div><span className="stat-icon peach">▦</span><div><strong>{classCount}<small>Classes in programme</small></strong></div></div></section>
    <section><div className="section-heading"><div><h2>Your courses</h2><p>A view of the current programme.</p></div><Link href="/admin">Manage courses →</Link></div><div className="subject-grid">{subjects.map(subject => <article className="panel" key={subject.id}><span className="eyebrow">{subject.category}</span><h3>{subject.title}</h3><p>{subject.description}</p><p>{subject.teacher} · {subject._count.classes} classes</p></article>)}</div></section>
  </>;
}
