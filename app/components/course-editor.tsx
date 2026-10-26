 'use client';
import { useState } from 'react';
export function CourseEditor({ subject }: { subject: { id: string; title: string; description: string; teacher: string } }) {
  const [status, setStatus] = useState('');
  return <form className="course-editor" onSubmit={async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setStatus('Saving…');
    try {
      const response = await fetch(`/api/admin/subjects/${subject.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) });
      setStatus(response.ok ? 'Course saved.' : 'Could not save course.');
    } catch { setStatus('Could not save course.'); }
  }}><h2>{subject.title}</h2><label>Title<input name="title" defaultValue={subject.title} required maxLength={200} /></label><label>Teacher<input name="teacher" defaultValue={subject.teacher} required maxLength={200} /></label><label>Description<textarea name="description" defaultValue={subject.description} required maxLength={10000} /></label><button>Save course</button><p role="status">{status}</p></form>;
}
