'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { StudentNote, StudentSnapshot } from '@/lib/catalog';

async function mutate<T>(path: string, method: string, data?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Could not save your changes. Please try again.');
  return result as T;
}
function useStudentState(initial: StudentSnapshot) {
  const [notes, setNotes] = useState(initial.notes);
  const [watched, updateWatched] = useState(initial.watched);
  return {
    ...initial, notes, watched,
    async createNote(classId: string, content: string) {
      const note = await mutate<StudentNote>(`/api/classes/${classId}/notes`, 'POST', { content });
      setNotes(current => [...current, note]);
    },
    async updateNote(classId: string, id: string, content: string) {
      const note = await mutate<StudentNote>(`/api/classes/${classId}/notes/${id}`, 'PATCH', { content });
      setNotes(current => current.map(item => item.id === id ? note : item));
    },
    async deleteNote(classId: string, id: string) {
      await mutate(`/api/classes/${classId}/notes/${id}`, 'DELETE');
      setNotes(current => current.filter(item => item.id !== id));
    },
    async setWatched(classId: string, value: boolean) {
      await mutate(`/api/classes/${classId}/progress`, 'PUT', { watched: value });
      updateWatched(current => value ? [...current.filter(id => id !== classId), classId] : current.filter(id => id !== classId));
    },
  };
}
const Context = createContext<ReturnType<typeof useStudentState> | null>(null);
export function StudentProvider({ initial, children }: { initial: StudentSnapshot; children: ReactNode }) {
  const state = useStudentState(initial);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useStudent() {
  const state = useContext(Context);
  if (!state) throw new Error('StudentProvider required');
  return state;
}
