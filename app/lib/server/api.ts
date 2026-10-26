import 'server-only';
import { db } from './db';
import { requireStudentId } from './student';
import { StudentInputError, studentRepository } from '../student-repository';

export const repository = async () => studentRepository(db, await requireStudentId());
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await request.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch { /* Return a predictable validation response for malformed JSON. */ }
  throw new StudentInputError('A JSON object is required.');
}
export async function respond(work: () => Promise<unknown>) {
  try { return Response.json(await work(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    if (error instanceof StudentInputError) return Response.json({ error: error.message }, { status: error.status });
    console.error('Student database request failed:', error);
    return Response.json({ error: 'Could not save your changes. Please try again.' }, { status: 500 });
  }
}

export function requireOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(process.env.BETTER_AUTH_URL!).origin) {
    throw new StudentInputError('Invalid request origin.', 403);
  }
}
