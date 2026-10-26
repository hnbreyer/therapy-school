import { requireAdmin } from '@/lib/server/student';
import { jsonBody, respond, requireOrigin } from '@/lib/server/api';
import { StudentInputError } from '@/lib/student-repository';
import { db } from '@/lib/server/db';
export async function PATCH(request: Request, { params }: { params: Promise<{ subjectId: string }> }) {
  return respond(async () => {
    await requireAdmin();
    requireOrigin(request);
    const body = await jsonBody(request);
    const data: Record<string, string> = {};
    for (const key of ['title', 'teacher', 'description']) {
      const value = body[key];
      if (typeof value !== 'string' || !value.trim() || value.length > (key === 'description' ? 10000 : 200)) throw new StudentInputError('Invalid course details.');
      data[key] = value.trim();
    }
    const { subjectId } = await params;
    const result = await db.subject.updateMany({ where: { id: subjectId }, data });
    if (!result.count) throw new StudentInputError('Course not found.', 404);
    return { saved: true };
  });
}
