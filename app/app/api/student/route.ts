import { connection } from 'next/server';
import { repository, respond } from '@/lib/server/api';
export async function GET() { await connection(); return respond(async () => (await repository()).snapshot()); }
