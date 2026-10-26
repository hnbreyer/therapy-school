import { requireAdmin } from '@/lib/server/student';
import { db } from '@/lib/server/db';
import { jsonBody, respond, requireOrigin } from '@/lib/server/api';
import { courseRepository } from '@/lib/course-repository';
export async function PATCH(request: Request, { params }: { params: Promise<{ subjectId: string; classId: string }> }) {
  return respond(async () => {
    await requireAdmin();
    requireOrigin(request);
    const body = await jsonBody(request);
    const { subjectId, classId } = await params;
    return courseRepository(db).updateClass(subjectId, classId, body);
  });
}
