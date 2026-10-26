import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { databaseUrl } from './lib/database-url';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: databaseUrl() },
});
