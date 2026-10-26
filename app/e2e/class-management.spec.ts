import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
const origin = 'http://127.0.0.1:3102';
const headers = { Origin: origin };
async function login(client: APIRequestContext, email: string) {
  const signIn = () => client.post('/api/auth/sign-in/email', { headers, data: { email, password: 'Haven-local-2026!' } });
  let response = await signIn();
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, (Number(response.headers()['retry-after']) || 10) * 1000 + 100));
    response = await signIn();
  }
  expect(response.ok()).toBeTruthy();
}
test('administrators edit classes while student work and role restrictions are preserved', async ({ playwright, browser }) => {
  test.setTimeout(120000);
  const admin = await playwright.request.newContext({ baseURL: origin });
  const student = await playwright.request.newContext({ baseURL: origin });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  let original: Record<string, unknown> | undefined;
  let noteId: string | undefined;
  let previousWatched = false;
  const classId = 'listening-1';
  const url = `/api/admin/subjects/listening/classes/${classId}`;
  let adminBrowser: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    await login(admin, 'admin@example.test');
    await login(student, 'robin@example.test');
    const initial = await (await student.get('/api/student')).json();
    original = initial.lessons.find((lesson: { id: string }) => lesson.id === classId);
    expect(original).toBeTruthy();
    if (!original) throw new Error('Test class is missing.');
    previousWatched = initial.watched.includes(classId);
    const note = await student.post(`/api/classes/${classId}/notes`, { headers, data: { content: 'Preserve this private reflection during class editing.' } });
    expect(note.ok()).toBeTruthy(); noteId = (await note.json()).id;
    await student.put(`/api/classes/${classId}/progress`, { headers, data: { watched: true } });
    const before = await (await student.get('/api/student')).json();
    expect((await anonymous.patch(url, { headers, data: original })).status()).toBe(401);
    expect((await student.patch(url, { headers, data: original })).status()).toBe(403);
    expect((await admin.patch(url, { headers: { Origin: 'https://evil.example' }, data: original })).status()).toBe(403);
    expect((await admin.patch('/api/admin/subjects/foundations/classes/listening-1', { headers, data: original })).status()).toBe(404);
    expect((await admin.patch(url, { headers, data: { ...original, duration: 0 } })).status()).toBe(400);
    expect((await admin.patch(url, { headers, data: { ...original, recordingUrl: 'javascript:alert(1)' } })).status()).toBe(400);
    const unchanged = await (await student.get('/api/student')).json();
    expect(unchanged.lessons.find((lesson: { id: string }) => lesson.id === classId)).toEqual(original);
    adminBrowser = await browser.newContext({ storageState: await admin.storageState() });
    const page = await adminBrowser.newPage();
    await page.goto(`${origin}/admin`);
    const details = page.locator('details').filter({ has: page.locator('summary', { hasText: String(original!.title) }) });
    await details.locator('summary').click();
    const title = `Updated listening class ${Date.now()}`;
    await details.getByLabel('Class title', { exact: true }).fill(title);
    await details.getByLabel('Class description').fill('Updated class description.');
    await details.getByLabel('Start time (São Paulo, UTC−3)').fill('2026-11-05T16:30');
    await details.getByLabel('Duration (minutes)').fill('105');
    await details.getByLabel('Recording URL').fill('https://example.org/updated-recording');
    await details.getByLabel('Live meeting URL').fill('https://example.org/updated-meeting');
    await details.getByRole('button', { name: 'Save class', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Class saved.' })).toBeVisible();
    await page.reload();
    await expect(page.locator('summary').filter({ hasText: title })).toBeVisible();
    const after = await (await student.get('/api/student')).json();
    expect(after.lessons.find((lesson: { id: string }) => lesson.id === classId)).toMatchObject({ id: classId, subjectId: 'listening', title, description: 'Updated class description.', duration: 105, startsAt: '2026-11-05T19:30:00.000Z', recordingUrl: 'https://example.org/updated-recording', zoomUrl: 'https://example.org/updated-meeting', materials: original.materials });
    expect(after.notes).toEqual(before.notes);
    expect(after.watched).toEqual(before.watched);
    expect((await admin.patch(url, { headers, data: { ...original, recordingUrl: '', zoomUrl: '' } })).ok()).toBeTruthy();
    const cleared = await (await student.get('/api/student')).json();
    expect(cleared.lessons.find((lesson: { id: string }) => lesson.id === classId)).toMatchObject({ recordingUrl: null, zoomUrl: null });
  } finally {
    if (original) await admin.patch(url, { headers, data: original });
    if (noteId) await student.delete(`/api/classes/${classId}/notes/${noteId}`, { headers });
    await student.put(`/api/classes/${classId}/progress`, { headers, data: { watched: previousWatched } });
    await adminBrowser?.close();
    await Promise.all([admin, student, anonymous].map(client => client.dispose()));
  }
});


test('administrators add classes and manage their materials', async ({ playwright, browser }) => {
  test.setTimeout(120000);
  const admin = await playwright.request.newContext({ baseURL: origin });
  const student = await playwright.request.newContext({ baseURL: origin });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  let createdId: string | undefined;
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  const collection = '/api/admin/subjects/listening/classes';
  const payload = { title: 'Creation test', description: 'Class description', startsAt: '2026-11-05T19:30:00.000Z', duration: 90, recordingUrl: '', zoomUrl: '', materials: [] };
  try {
    await login(admin, 'admin@example.test');
    await login(student, 'robin@example.test');
    expect((await anonymous.post(collection, { headers, data: payload })).status()).toBe(401);
    expect((await student.post(collection, { headers, data: payload })).status()).toBe(403);
    expect((await admin.post(collection, { headers: { Origin: 'https://evil.example' }, data: payload })).status()).toBe(403);
    expect((await admin.post('/api/admin/subjects/missing/classes', { headers, data: payload })).status()).toBe(404);
    context = await browser.newContext({ storageState: await admin.storageState() });
    const page = await context.newPage();
    await page.goto(`${origin}/admin`);
    const course = page.getByRole('region', { name: 'The art of therapeutic listening', exact: true });
    const creator = course.locator('details').filter({ has: page.locator('summary', { hasText: /^Add class$/ }) });
    await creator.locator('summary').click();
    const title = `New seminar ${Date.now()}`;
    await creator.getByLabel('Class title', { exact: true }).fill(title);
    await creator.getByLabel('Class description').fill('New seminar description.');
    await creator.getByLabel('Start time (São Paulo, UTC−3)').fill('2026-11-05T16:30');
    await creator.getByRole('button', { name: 'Add material', exact: true }).click();
    await creator.getByLabel('Material 1 title', { exact: true }).fill('Seminar guide');
    await creator.getByLabel('Material 1 URL', { exact: true }).fill('/materials/reflection-guide.txt');
    const createdResponse = page.waitForResponse(response => response.url().endsWith(collection) && response.request().method() === 'POST');
    await creator.getByRole('button', { name: 'Add class', exact: true }).click();
    const response = await createdResponse;
    expect(response.ok()).toBeTruthy(); createdId = (await response.json()).id;
    await expect(creator.getByRole('status')).toContainText('Class added.');
    await page.reload();
    const editor = course.locator('details').filter({ has: page.locator('summary', { hasText: title }) });
    await editor.locator('summary').click();
    await expect(editor.getByLabel('Material 1 title', { exact: true })).toHaveValue('Seminar guide');
    await editor.getByLabel('Material 1 title', { exact: true }).fill('Updated guide');
    await editor.getByLabel('Material 1 URL', { exact: true }).fill('/materials/updated-guide.pdf');
    await editor.getByRole('button', { name: 'Add material', exact: true }).click();
    await editor.getByLabel('Material 2 title', { exact: true }).fill('Extra reading');
    await editor.getByLabel('Material 2 URL', { exact: true }).fill('https://example.org/reading');
    await editor.getByRole('button', { name: 'Save class', exact: true }).click();
    await expect(editor.getByRole('status')).toContainText('Class saved.');
    const saved = await (await student.get('/api/student')).json();
    expect(saved.lessons.find((lesson: { id: string }) => lesson.id === createdId).materials).toEqual(expect.arrayContaining([{ title: 'Updated guide', url: '/materials/updated-guide.pdf' }, { title: 'Extra reading', url: 'https://example.org/reading' }]));
    await page.reload(); await editor.locator('summary').click();
    await editor.getByRole('button', { name: 'Remove material 1', exact: true }).click();
    await editor.getByRole('button', { name: 'Save class', exact: true }).click();
    await expect(editor.getByRole('status')).toContainText('Class saved.');
    const final = await (await student.get('/api/student')).json();
    expect(final.lessons.find((lesson: { id: string }) => lesson.id === createdId).materials).toHaveLength(1);
    expect((await student.patch(`${collection}/${createdId}`, { headers, data: { ...payload, materials: [] } })).status()).toBe(403);
  } finally {
    if (createdId) {
      execFileSync(process.execPath, ['--input-type=module', '-e', `
        import { DatabaseSync } from 'node:sqlite';
        const db = new DatabaseSync(process.argv[1]);
        db.exec('PRAGMA foreign_keys = ON');
        db.prepare('DELETE FROM Class WHERE id = ?').run(process.argv[2]);
        db.close();
      `, resolve('prisma/e2e.db'), createdId], { stdio: 'pipe' });
    }
    await context?.close();
    await Promise.all([admin, student, anonymous].map(client => client.dispose()));
  }
});
