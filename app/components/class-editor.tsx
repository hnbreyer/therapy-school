'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, formatTime } from '@/lib/catalog';
type EditableClass = {
  id: string; title: string; description: string; startsAt: string; duration: number;
  recordingUrl: string | null; zoomUrl: string | null;
  materials: { id: string; title: string; url: string }[];
};
function saoPauloInput(value: string) {
  return new Date(new Date(value).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
export function ClassEditor({ subjectId, lesson }: { subjectId: string; lesson: EditableClass }) {
  // A tab open before the add/edit split may still send the old creation props.
  if (!lesson) return <NewClassEditor subjectId={subjectId} />;
  return <ClassForm key={lesson.id} subjectId={subjectId} lesson={lesson} isNew={false} />;
}

export function NewClassEditor({ subjectId }: { subjectId: string }) {
  return <ClassForm subjectId={subjectId} isNew lesson={{ id: '', title: '', description: '', startsAt: '', duration: 90, recordingUrl: null, zoomUrl: null, materials: [] }} />;
}

function ClassForm({ subjectId, lesson, isNew }: { subjectId: string; lesson: EditableClass; isNew: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [materials, setMaterials] = useState<(EditableClass['materials'][number] & { key: string })[]>(() => lesson.materials.map(material => ({ ...material, key: material.id })));
  return <details className="managed-class"><summary><strong>{isNew ? 'Add class' : lesson.title}</strong>{!isNew && <span>{formatDate(lesson.startsAt)} · {formatTime(lesson.startsAt)} São Paulo · {lesson.duration} min</span>}</summary><form className="course-editor" aria-label={isNew ? 'Add class' : `Edit ${lesson.title}`} onSubmit={async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true); setStatus('Saving…');
    try {
      const startsAt = new Date(`${fields.get('startsAt')}-03:00`).toISOString();
      const response = await fetch(`/api/admin/subjects/${subjectId}/classes${isNew ? '' : `/${lesson.id}`}`, {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fields.get('title'), description: fields.get('description'), startsAt, duration: Number(fields.get('duration')), recordingUrl: fields.get('recordingUrl'), zoomUrl: fields.get('zoomUrl'), materials: materials.map(({ id, title, url }) => ({ ...(id ? { id } : {}), title, url })) }),
      });
      const body = await response.json();
      if (!response.ok) setStatus(body.error ?? 'Could not save class.');
      else {
        setStatus(isNew ? 'Class added.' : 'Class saved.');
        if (isNew) { form.reset(); setMaterials([]); }
        else setMaterials(body.materials.map((material: EditableClass['materials'][number]) => ({ ...material, key: material.id })));
        router.refresh();
      }
    } catch { setStatus('Could not save class. Please try again.'); }
    finally { setPending(false); }
  }}>
    <label>Class title<input name="title" defaultValue={lesson.title} required maxLength={200} /></label>
    <label>Class description<textarea name="description" defaultValue={lesson.description} required maxLength={10000} /></label>
    <div className="class-schedule"><label>Start time (São Paulo, UTC−3)<input name="startsAt" type="datetime-local" defaultValue={isNew ? '' : saoPauloInput(lesson.startsAt)} required /></label><label>Duration (minutes)<input name="duration" type="number" min={1} max={1440} step={1} defaultValue={lesson.duration} required /></label></div>
    <label>Recording URL<input name="recordingUrl" type="url" defaultValue={lesson.recordingUrl ?? ''} maxLength={2048} /></label>
    <label>Live meeting URL<input name="zoomUrl" type="url" defaultValue={lesson.zoomUrl ?? ''} maxLength={2048} /></label>
    <p className="muted-small">Leave a link empty when it is not available.</p>
    <fieldset className="material-editor" disabled={pending}><legend>Class materials</legend><p className="muted-small">Add a title and a file path or web link for each resource. Changes take effect when you save the class.</p>{materials.map((material, index) => <div className="material-editor-row" key={material.key}><label>Material {index + 1} title<input value={material.title} required maxLength={200} onChange={event => setMaterials(current => current.map(item => item.key === material.key ? { ...item, title: event.target.value } : item))} /></label><label>Material {index + 1} URL<input value={material.url} required maxLength={2048} placeholder="/materials/guide.pdf or https://…" onChange={event => setMaterials(current => current.map(item => item.key === material.key ? { ...item, url: event.target.value } : item))} /></label><button type="button" onClick={() => setMaterials(current => current.filter(item => item.key !== material.key))}>Remove material {index + 1}</button></div>)}<button type="button" disabled={materials.length >= 50} onClick={() => setMaterials(current => [...current, { key: crypto.randomUUID(), id: '', title: '', url: '' }])}>Add material</button></fieldset>
    <button disabled={pending}>{pending ? 'Saving…' : isNew ? 'Add class' : 'Save class'}</button><p role="status" aria-live="polite">{status}</p>
  </form></details>;
}
