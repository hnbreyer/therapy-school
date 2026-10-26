// This page waits for verified session identity before rendering.
export const instant = false;
import { requirePageUser } from '@/lib/server/student';
import { SubjectIndex } from '@/components/learning';
export default async function SubjectsPage() { await requirePageUser('STUDENT'); return <><div className="page-heading"><div><span className="eyebrow">YOUR PROGRAMME · YEAR 1</span><h1>My subjects</h1><p>Explore your subjects, find your next class, and keep growing.</p></div></div><SubjectIndex/></>; }
