import { jsonBody, repository, respond, requireOrigin } from '@/lib/server/api';

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  return respond(async () => {
    const own = await repository();
    requireOrigin(request);
    const { classId } = await params;
    const { content } = await jsonBody(request);
    return own.createNote(classId, content);
  });
}
