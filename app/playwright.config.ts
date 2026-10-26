import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:3102' },
  webServer: {
    command: 'npm run db:init && npm run db:seed:accounts && npm run dev -- --hostname 127.0.0.1 --port 3102',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: false,
    timeout: 120000,
    env: { DATABASE_URL: 'file:./prisma/e2e.db', NEXT_DIST_DIR: '.next-e2e', SEED_DEVELOPMENT_ACCOUNTS: 'true', BETTER_AUTH_URL: 'http://127.0.0.1:3102', BETTER_AUTH_SECRET: 'e2e-only-fictional-secret-at-least-32-characters' },
  },
});
