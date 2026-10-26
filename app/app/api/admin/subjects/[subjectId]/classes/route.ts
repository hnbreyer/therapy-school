import { requireAdmin } from '@/lib/server/student';
import { db } from '@/lib/server/db';
import { jsonBody, respond, requireOrigin } from '@/lib/server/api';
import { courseRepository } from '@/lib/course-repository';
export async function POST(request: Request, { params }: { params: Promise<{ subjectId: string }> }) {
  return respond(async () => {
    await requireAdmin();
    requireOrigin(request);
    const { subjectId } = await params;
    return courseRepository(db).createClass(subjectId, await jsonBody(request));
  });
}
