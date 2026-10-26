import { expect, test, type APIRequestContext } from '@playwright/test';
const origin = 'http://127.0.0.1:3102';
const headers = { Origin: origin };
async function login(client: APIRequestContext, email: string) {
  const signIn = () => client.post('/api/auth/sign-in/email', { headers, data: { email, password: 'Haven-local-2026!' } });
  let response = await signIn();
  if (response.status() === 429) {
    // Respect the library's login throttling when several test accounts share one IP.
    await new Promise(resolve => setTimeout(resolve, (Number(response.headers()['retry-after']) || 10) * 1000 + 100));
    response = await signIn();
  }
  expect(response.ok(), `${email}: ${response.status()} ${await response.text()}`).toBeTruthy();
}
test('sessions enforce ownership, roles, origin checks and logout', async ({ playwright, page, browser }) => {
  const owner = await playwright.request.newContext({ baseURL: origin });
  const other = await playwright.request.newContext({ baseURL: origin });
  const admin = await playwright.request.newContext({ baseURL: origin });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  let noteId: string | undefined;
  try {
    expect((await anonymous.get('/api/student')).status()).toBe(401);
    expect((await anonymous.post('/api/classes/listening-1/notes', { headers, data: { content: 'no' } })).status()).toBe(401);
    await page.goto('/classes/listening-1');
    await expect(page).toHaveURL('/login');
    expect((await anonymous.post('/api/auth/sign-up/email', { headers, data: { name: 'Intruder', email: 'intruder@example.test', password: 'Haven-local-2026!', role: 'ADMIN' } })).ok()).toBeFalsy();
    expect((await anonymous.post('/api/auth/sign-in/email', { headers, data: { email: 'jamie@example.test', password: 'wrong-password' } })).ok()).toBeFalsy();
    await login(owner, 'jamie@example.test');
    await login(other, 'robin@example.test');
    await login(admin, 'admin@example.test');
    const adminBrowser = await browser.newContext({ storageState: await admin.storageState() });
    try {
      const adminPage = await adminBrowser.newPage();
      await adminPage.goto(`${origin}/`);
      await expect(adminPage).toHaveURL(`${origin}/`);
      await expect(adminPage.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
      const managementTab = adminPage.getByRole('navigation').getByRole('link', { name: 'Course management' });
      await managementTab.click();
      await expect(adminPage).toHaveURL(`${origin}/admin`);
      await expect(adminPage.getByRole('heading', { name: 'Course management' })).toBeVisible();
      await expect(managementTab).toHaveAttribute('aria-current', 'page');
      await adminPage.getByRole('link', { name: 'Dashboard', exact: false }).click();
      await expect(adminPage).toHaveURL(`${origin}/`);
    } finally { await adminBrowser.close(); }

    const created = await owner.post('/api/classes/listening-1/notes', { headers, data: { content: 'Private owner reflection', studentId: 'dev-robin' } });
    expect(created.ok()).toBeTruthy(); noteId = (await created.json()).id;
    const ownerState = await (await owner.get('/api/student?studentId=dev-robin')).json();
    expect(ownerState.student.id).toBe('dev-jamie');
    expect(ownerState.notes).toContainEqual(expect.objectContaining({ id: noteId }));
    const otherState = await (await other.get('/api/student?studentId=dev-jamie')).json();
    expect(otherState.notes.some((note: { id: string }) => note.id === noteId)).toBeFalsy();
    const url = `/api/classes/listening-1/notes/${noteId}`;
    expect((await other.patch(url, { headers, data: { content: 'stolen', studentId: 'dev-jamie' } })).status()).toBe(404);
    expect((await other.delete(url, { headers })).status()).toBe(404);
    expect((await owner.patch(url, { headers: { Origin: 'https://evil.example' }, data: { content: 'csrf' } })).status()).toBe(403);
    await owner.put('/api/classes/listening-2/progress', { headers, data: { watched: true } });
    await other.put('/api/classes/listening-2/progress', { headers, data: { watched: false, studentId: 'dev-jamie' } });
    const after = await (await owner.get('/api/student')).json();
    expect(after.watched).toContain('listening-2');
    expect(after.notes.find((note: { id: string }) => note.id === noteId).content).toBe('Private owner reflection');
    expect((await (await other.get('/api/student')).json()).watched).not.toContain('listening-2');
    expect((await admin.get('/api/student')).status()).toBe(403);
    const course = ownerState.subjects[0];
    const change = { title: course.title, teacher: course.teacher, description: course.description };
    expect((await other.patch(`/api/admin/subjects/${course.id}`, { headers, data: change })).status()).toBe(403);
    const studentBrowser = await browser.newContext({ storageState: await other.storageState() });
    try {
      const studentPage = await studentBrowser.newPage();
      await studentPage.goto(`${origin}/admin`);
      await expect(studentPage).toHaveURL(`${origin}/`);
      await expect(studentPage.getByRole('button', { name: 'Save course' })).toHaveCount(0);
      await expect(studentPage.getByRole('link', { name: 'Course management', exact: false })).toHaveCount(0);
    } finally { await studentBrowser.close(); }
    expect((await anonymous.patch(`/api/admin/subjects/${course.id}`, { headers, data: change })).status()).toBe(401);
    expect((await admin.patch(`/api/admin/subjects/${course.id}`, { headers, data: change })).ok()).toBeTruthy();
    const savedSession = await owner.storageState();
    expect((await owner.post('/api/auth/sign-out', { headers, data: {} })).ok()).toBeTruthy();
    expect((await owner.get('/api/student')).status()).toBe(401);
    const replay = await playwright.request.newContext({ baseURL: origin, storageState: savedSession });
    try { expect((await replay.get('/api/student')).status()).toBe(401); } finally { await replay.dispose(); }
    await login(owner, 'jamie@example.test');
  } finally {
    if (noteId) await owner.delete(`/api/classes/listening-1/notes/${noteId}`, { headers });
    await owner.put('/api/classes/listening-2/progress', { headers, data: { watched: false } });
    await Promise.all([owner, other, admin, anonymous].map(client => client.dispose()));
  }
});
