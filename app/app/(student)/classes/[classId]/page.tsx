// This page waits for verified session identity before rendering.
export const instant = false;
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ClassDetail } from '@/components/class-detail';
import { loadClass } from '@/lib/server/data';

type ClassPageProps = { params: Promise<{ classId: string }> };

export default function ClassPage({ params }: ClassPageProps) {
  return (
    <Suspense fallback={<section className="panel" role="status">Loading your class…</section>}>
      <ClassContent params={params} />
    </Suspense>
  );
}

async function ClassContent({ params }: ClassPageProps) {
  const { classId } = await params;
  const data = await loadClass(classId);
  if (!data) notFound();
  return <ClassDetail key={classId} lesson={data.lesson} subject={data.subject} />;
}
