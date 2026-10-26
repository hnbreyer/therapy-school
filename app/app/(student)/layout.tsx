// Session checks and redirects must finish before entering the protected space.
export const instant = false;
import { Suspense } from 'react';
import { Shell } from '@/components/shell';
import { StudentBootstrap } from '@/components/student-bootstrap';
import { requirePageUser } from '@/lib/server/student';
async function LearningSpace({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (user.role === 'ADMIN') return <Shell name={user.name} role="ADMIN">{children}</Shell>;
  return <StudentBootstrap><Shell name={user.name} role="STUDENT">{children}</Shell></StudentBootstrap>;
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status">Loading learning space…</p>}><LearningSpace>{children}</LearningSpace></Suspense>;
}
