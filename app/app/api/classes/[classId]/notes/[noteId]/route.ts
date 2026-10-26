import { jsonBody, repository, respond, requireOrigin } from '@/lib/server/api';

type Context = { params: Promise<{ classId: string; noteId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return respond(async () => {
    const own = await repository();
    requireOrigin(request);
    const { classId, noteId } = await params;
    const { content } = await jsonBody(request);
    return own.updateNote(classId, noteId, content);
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    const own = await repository();
    requireOrigin(request);
    const { classId, noteId } = await params;
    await own.deleteNote(classId, noteId);
    return { deleted: true };
  });
}
