'use client';

import { useState, type FormEvent } from 'react';
import type { Lesson, StudentNote } from '@/lib/catalog';
import { useStudent } from './student-state';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Could not save your changes. Please try again.';
}
export function WatchedControl({ lesson }: { lesson: Lesson }) {
  const { watched, setWatched } = useStudent();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const complete = watched.includes(lesson.id);
  async function toggle() {
    setPending(true);
    setMessage('');
    try {
      await setWatched(lesson.id, !complete);
      setMessage('Progress saved to the database.');
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setPending(false); }
  }
  return <><button className={`button ${complete ? 'complete-button' : 'dark'}`} disabled={pending || !lesson.recordingUrl} aria-pressed={complete} onClick={toggle}>{pending ? 'Saving progress…' : complete ? '✓ Watched · Mark as unwatched' : '✓ Mark class as watched'}</button>{!lesson.recordingUrl && <small>Available once the recording is published.</small>}<p className="note-status" role="status" aria-label="Progress status">{message}</p></>;
}

function ExistingNote({ note }: { note: StudentNote }) {
  const { updateNote, deleteNote } = useStudent();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      await updateNote(note.classId, note.id, draft);
      setEditing(false);
      setMessage('Note saved to the database.');
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setPending(false); }
  }
  async function remove() {
    setPending(true);
    setMessage('');
    try { await deleteNote(note.classId, note.id); }
    catch (error) { setMessage(errorMessage(error)); setPending(false); }
  }
  return <article className="saved-note" aria-label="Saved class note">
    {editing ? <form onSubmit={save}><label htmlFor={`edit-${note.id}`}>Edit note</label><textarea id={`edit-${note.id}`} value={draft} onChange={event => setDraft(event.target.value)} required maxLength={10000} disabled={pending}/><div className="note-actions"><button className="button dark" disabled={pending || !draft.trim()}>{pending ? 'Saving…' : 'Save changes'}</button><button className="button secondary-button" type="button" disabled={pending} onClick={() => { setEditing(false); setDraft(note.content); setMessage(''); }}>Cancel</button></div></form> : <><p className="note-content">{note.content}</p><div className="note-actions"><button className="button secondary-button" onClick={() => { setDraft(note.content); setEditing(true); setMessage(''); }}>Edit note</button><button className="button delete-button" disabled={pending} onClick={remove}>{pending ? 'Deleting…' : 'Delete note'}</button></div></>}
    <p className="note-status" role="status">{message}</p>
  </article>;
}

export function ClassNotes({ classId, title }: { classId: string; title: string }) {
  const { notes, createNote } = useStudent();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const classNotes = notes.filter(note => note.classId === classId);
  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      await createNote(classId, draft);
      setDraft('');
      setMessage('Note saved to the database.');
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setPending(false); }
  }
  return <section className="panel notes-panel"><div className="section-heading"><div><h2>Your class notes</h2><p>Your private reflections for this class.</p></div><span className="eyebrow">PRIVATE NOTES</span></div>
    <p className="muted-small">Only your account can access these notes.</p>
    <form onSubmit={create}><label htmlFor="class-notes">New note for {title}</label><textarea id="class-notes" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Capture an idea, a question, or something to revisit…" rows={5} required maxLength={10000} disabled={pending}/><button className="button dark" disabled={pending || !draft.trim()}>{pending ? 'Saving…' : 'Add note'}</button></form>
    <p className="note-status" role="status" aria-label="New note status">{message || 'Notes are saved when you select Add note or Save changes.'}</p>
    <div className="saved-notes">{classNotes.length ? classNotes.map(note => <ExistingNote key={note.id} note={note}/>) : <p>No saved notes for this class yet.</p>}</div>
  </section>;
}
