import { StudentProvider } from './student-state';
import { loadStudent } from '@/lib/server/data';

export async function StudentBootstrap({ children }: { children: React.ReactNode }) {
  const initial = await loadStudent();
  return <StudentProvider initial={initial}>{children}</StudentProvider>;
}
