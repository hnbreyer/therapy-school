// This page waits for verified session identity before rendering.
export const instant = false;
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadSubject } from '@/lib/server/data';
import { LessonList, SubjectProgress } from '@/components/learning';
type SubjectPageProps = { params: Promise<{ subjectId: string }> };

export default function SubjectPage({ params }: SubjectPageProps) {
  return (
    <Suspense fallback={<section className="panel" role="status">Loading your subject…</section>}>
      <SubjectContent params={params} />
    </Suspense>
  );
}

async function SubjectContent({ params }: SubjectPageProps) {
 const { subjectId } = await params; const data = await loadSubject(subjectId); if (!data) notFound(); const { subject, lessons } = data;
 return <><Link className="back-link" href="/subjects">← All subjects</Link><div className="page-heading"><div><span className="eyebrow">{subject.category}</span><h1>{subject.title}</h1><p>{subject.description}</p></div></div><section className={`subject-intro ${subject.color}`}><div><span className="eyebrow">YOUR TUTOR</span><h2>{subject.teacher}</h2><p>{lessons.length} classes · {lessons.reduce((sum, lesson) => sum + lesson.duration, 0) / 60} hours of learning</p></div><SubjectProgress subjectId={subject.id}/></section><div className="section-heading"><div><h2>Your classes</h2><p>Follow the journey in chronological order. All times in São Paulo (UTC−3).</p></div></div><LessonList items={lessons}/></>;
}
