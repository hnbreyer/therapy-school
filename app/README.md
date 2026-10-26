# Haven student portal

A responsive Next.js App Router and TypeScript application backed by Prisma 7 and local SQLite. The catalogue and student work come from the database; localStorage is no longer used.

## Initialize and run

Use Node.js 24 LTS and run commands from this `app/` directory:

```sh
npm install
cp .env.example .env
npm run db:init
npm run dev
```

Open http://localhost:3000 using the exact origin configured in `BETTER_AUTH_URL`. `db:init` generates the Prisma client, creates the SQLite file if absent, applies tracked migrations with `prisma migrate deploy`, and seeds the fictional programme. It does not truncate an existing database. The default file is `app/prisma/dev.db` relative to the repository root. All relative `file:` URLs resolve from this application directory for both CLI and runtime.

If your package manager requires approval for dependency build scripts, allow the Prisma engine and better-sqlite3 scripts when prompted. Prisma generation runs during postinstall and `db:init`.

Useful commands:

```sh
npm run db:generate  # regenerate after changing the Prisma schema
npm run db:migrate   # apply checked-in migrations; creates a file if needed
npm run db:seed      # refresh fictional catalogue, preserving notes and existing progress
npx prisma migrate dev --name describe_change # create a future schema migration
```

Set `DATABASE_URL` to another local `file:` URL to use a different database. SQLite requires a writable, persistent filesystem and the Node.js runtime. A local database file is not durable on ephemeral/serverless instances and is not a shared database across multiple app servers. Do not commit database files or `.env`.

For a local production-build preview:

```sh
npm run build
npm start
```

## Authentication and local accounts

Better Auth handles password hashing, database sessions, secure HttpOnly cookies, login, logout, and authentication origin checks. Public registration is disabled. Server loaders and API handlers verify the session and current database role on every request. Private queries use the linked Student ID, never a browser-supplied ID. Administrators cannot read student notes or progress. Student pages redirect to `/login` without a session; APIs return 401, or 403 for a role mismatch. Logout revokes the database session. Mutations require a matching Origin header.

After `db:init`, generate a secret (`openssl rand -base64 32`), set `BETTER_AUTH_SECRET` in `.env`, and set `BETTER_AUTH_URL` to the exact origin you use, e.g. `http://localhost:3000`. Then explicitly provision fictional local accounts:

```sh
# Only for a local fictional database; .env.example includes this opt-in.
npm run db:seed:accounts
```

All three accounts use the fictional password `Haven-local-2026!`:

| Email | Role | Destination |
| --- | --- | --- |
| jamie@example.test | Student, Jamie Lewis | `/` |
| robin@example.test | Student, Robin Chen | `/` |
| admin@example.test | Administrator, Alex Morgan | `/` |

The account seed requires `SEED_DEVELOPMENT_ACCOUNTS=true`; normal `db:init` and catalogue seeding do not create credentials. Account seed reruns preserve passwords, notes, progress, and roles. Remove this opt-in outside local development. Never provision these published credentials against real student data. No default secret or development identity bypass exists. Production requires a unique secret, the HTTPS application origin, and separately provisioned accounts. Account recovery, public registration, and account administration UI are outside this implementation.

Administrators land on the home page with a programme overview and a **Course management** navigation tab. The tab opens `/admin` for course title, teacher, and description editing. Each course lists its classes chronologically in expandable editors. Administrators can edit class titles, descriptions, start times in São Paulo (UTC−3), duration, recording URLs, and live meeting URLs, and add, edit, or remove class material titles and links. Each course also has an **Add class** form with the same fields and material controls. Materials accept HTTP/HTTPS URLs or local paths starting with `/`; this does not upload files. Class creation and material updates require administrator access. Material changes and class edits save atomically, and supplied material IDs must belong to the class being edited. Saving an existing class preserves its ID, student notes, and progress; unchanged materials retain their IDs; empty URLs clear the corresponding link. The nested class PATCH endpoint enforces administrator access, same-origin requests, course membership, and input validation. Both the page and PATCH endpoint verify the administrator role; hiding navigation is not the authorization boundary. Student accounts cannot edit the catalogue.

### Upgrading an existing SQLite database

Back up the SQLite database before applying migrations (stop the app and copy it, or use SQLite's backup API). Run `npm run db:generate` and `npm run db:migrate`. The authentication migration adds User, Account, Session, and Verification tables and an optional unique `Student.userId` foreign key. It does not delete or rewrite existing students, notes, progress, or courses. Existing students remain inaccessible until explicitly linked to a verified account. The local account seed links `dev-jamie` to Jamie's fictional account, preserving that student's historical work; it refuses to replace a different existing account link. For real identities, provision accounts securely and link each existing student to its verified owner instead of running the fictional seed.

Existing browser-local notes are not automatically imported. They are no longer displayed or used, and any old localStorage data is left untouched. New notes use explicit **Add note** and **Save changes** controls, with **Delete note** for removal. A success message appears only after the database confirms the write. Failed writes retain the draft. Watched status supports both watched and unwatched, and updates the dashboard and subject progress.

## Schema and architecture

- `Student`: display name and a unique account link.
- `User`, `Account`, `Session`, `Verification`: Better Auth identity, password hashes, database sessions, and verification records. User roles are STUDENT or ADMIN.
- `Subject`: programme metadata and display position.
- `Class`: belongs to a subject; contains chronological date, duration, recording and meeting links.
- `Material`: downloadable resources associated with a class.
- `Note`: multiple text notes per student/class, with creation and update timestamps. Reads and mutations are scoped by student and class.
- `ClassProgress`: one row per `(studentId, classId)` composite primary key, with a watched boolean and update timestamp. Repeated requests set the requested value rather than toggling it blindly.

Foreign keys enforce relationships and cascade dependent rows if a parent is deleted. Indexes support class chronology and per-student/class note reads. The first migration is tracked under `prisma/migrations/`; generated Prisma code is ignored and rebuilt during setup. Fictional data lives under `prisma/`, not in the runtime catalogue. Seeds use stable IDs and upserts: rerunning them preserves student notes and existing progress, including explicitly unwatched classes.

`lib/database-client.ts` creates Prisma clients using the SQLite adapter. `lib/server/db.ts` reuses one client during development hot reload. `lib/student-repository.ts` implements database reads, input validation, student ownership scoping, and writes; it accepts a client and student ID so tests can use isolated databases and receives identity only from a verified server session.

`lib/server/data.ts` loads request-time database state. Root and page Suspense boundaries keep loading states explicit. Subjects and classes are read from SQLite on each request; per-student data is not prerendered or placed in a shared cache. `components/student-state.tsx` starts with server-loaded data and calls route handlers under `app/api/classes/[classId]/` for note CRUD and progress updates. It updates client state only after successful writes. The existing responsive shell, subject cards, progress bars and class layout are preserved.

`lib/catalog.ts` contains serializable types and date formatting. `prisma/fixtures.ts` supplies fictional seed content. Class times use America/Sao_Paulo; the fictional programme retains October 25, 2026 as its dashboard reference date. Recording/Zoom URLs remain clearly labeled example.com placeholders. Sample materials download from `public/materials/`.

## Automated checks

Unit tests cover verified session and current-role checks, student identity resolution, protected-page redirects, API origin and JSON validation, controlled error responses, trusted route identifiers, administrator and student route handlers, server data loaders, authentication configuration, database URL resolution, São Paulo date formatting, role-specific navigation, password visibility, and form failure/draft retention. Logout network failures show a recoverable error. The SQLite integration tests continue to verify persistence, ownership isolation, migration preservation, and atomic class/material updates.

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Vitest runs Prisma integration tests on a fresh temporary SQLite database initialized with the tracked migration. They cover note create/edit/delete through new connections, per-class associations, student ownership isolation, watched/unwatched persistence and idempotency, invalid inputs, catalogue ordering, and non-destructive seed reruns. The temporary database is removed after the suite. Component tests cover server-rendered hydration, API writes, edit/delete controls, retained drafts on errors, and failed progress writes.

Browser regression tests run a separate local server and use `prisma/e2e.db` plus `.next-e2e`, leaving your development database and server alone:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

They authenticate explicitly and exercise cross-account isolation, forged owner IDs, anonymous access, role restrictions, CSRF origin rejection, invalid login, disabled registration, logout session revocation, and note creation, reload and a fresh browser context, editing and deletion, plus watched/unwatched persistence and subject/dashboard progress updates. Test notes are deleted and the tested progress is returned to unwatched. The separate E2E database is ignored by Git and can be deleted when no test server is running.

No centralized notebook, Zoom automation, payments, or student practice recordings are implemented.

### Prisma schema mismatch during development

If Better Auth reports missing `user`, `session`, `account`, and `verification` models after an upgrade, stop the development server, run `npm run db:generate` and `npm run db:migrate`, then restart `npm run dev`. Better Auth checks the generated Prisma client's model metadata; this message can indicate an old client still retained by a running process even when the SQLite tables already exist. The server singleton refreshes its cached client when the generated constructor or database URL changes. Do not reset the database or delete student work to resolve a stale client.
