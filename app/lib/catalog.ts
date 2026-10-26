export type Subject = { id: string; title: string; category: string; description: string; teacher: string; color: string; symbol: string };
export type Lesson = { id: string; subjectId: string; title: string; startsAt: string; duration: number; description: string; recordingUrl: string | null; zoomUrl: string | null; materials: { title: string; url: string }[] };

export const demoNow = '2026-10-25T12:00:00Z';
export type StudentNote = { id: string; classId: string; content: string; updatedAt: string };
export type StudentSnapshot = {
  student: { id: string; name: string };
  subjects: Subject[];
  lessons: Lesson[];
  notes: StudentNote[];
  watched: string[];
};
export function formatDate(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(date)); }
export function formatTime(date: string) { return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(date)); }
