import { jsonBody, repository, respond, requireOrigin } from '@/lib/server/api';

export async function PUT(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  return respond(async () => {
    const own = await repository();
    requireOrigin(request);
    const { classId } = await params;
    const { watched } = await jsonBody(request);
    return own.setWatched(classId, watched);
  });
}
