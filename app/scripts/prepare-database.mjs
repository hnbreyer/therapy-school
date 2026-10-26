import 'dotenv/config';
import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
if (!url.startsWith('file:')) throw new Error('DATABASE_URL must use a local SQLite file: URL.');
const path = resolve(url.slice(5));
await mkdir(dirname(path), { recursive: true });
// Create a new empty file if needed. Never truncate an existing database.
await (await open(path, 'a')).close();
