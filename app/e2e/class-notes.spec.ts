import { expect, test } from '@playwright/test';

async function loginPage(page: import('@playwright/test').Page) {
  await page.goto('http://127.0.0.1:3102/login');
  await page.getByLabel('Email').fill('jamie@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Haven-local-2026!');
  const submit = async () => {
    const response = page.waitForResponse(response => response.url().endsWith('/api/auth/sign-in/email'));
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    return response;
  };
  let response = await submit();
  if (response.status() === 429) {
    // All browser contexts share the same test IP; respect login throttling.
    await new Promise(resolve => setTimeout(resolve, (Number(response.headers()['retry-after']) || 10) * 1000 + 100));
    response = await submit();
  }
  expect(response.ok()).toBeTruthy();
  await expect(page).toHaveURL('http://127.0.0.1:3102/');
}
test.beforeEach(async ({ page }) => { await loginPage(page); });

test('notes persist across reload and fresh browser contexts, then edit and delete', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/classes/listening-1');
  const text = `Browser reflection ${Date.now()}`;
  await page.getByRole('textbox', { name: /new note for/i }).fill(text);
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByRole('status', { name: 'New note status' })).toContainText('saved to the database');
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toBeVisible();

  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const second = await fresh.newPage();
    await loginPage(second);
    await second.goto('http://127.0.0.1:3102/classes/listening-1');
    const saved = second.getByRole('article').filter({ hasText: text });
    await expect(saved).toBeVisible();
    expect(await second.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await saved.getByRole('button', { name: 'Edit note' }).click();
    await second.getByRole('textbox', { name: 'Edit note' }).fill(`${text} edited`);
    await second.getByRole('button', { name: 'Save changes' }).click();
    await expect(second.getByRole('textbox', { name: 'Edit note' })).toHaveCount(0);
    await expect(saved.getByRole('status')).toContainText('saved to the database');
    await expect(saved.getByText(`${text} edited`, { exact: true })).toBeVisible();
    await second.reload();
    const edited = second.getByRole('article').filter({ hasText: `${text} edited` });
    await edited.getByRole('button', { name: 'Delete note' }).click();
    await expect(edited).toHaveCount(0);
    await second.reload();
    await expect(second.getByText(`${text} edited`, { exact: true })).toHaveCount(0);
  } finally { await fresh.close().catch(() => {}); }
  expect(errors).toEqual([]);
});

test('watched status persists, changes dashboard progress, and can be undone', async ({ page }) => {
  // This server uses its own e2e.db; never change the developer's dev.db.
  await page.request.put('/api/classes/listening-2/progress', { headers: { Origin: 'http://127.0.0.1:3102' }, data: { watched: false } });
  await page.goto('/classes/listening-2');
  await page.getByRole('button', { name: /mark class as watched/i }).click();
  await expect(page.getByRole('button', { name: /mark as unwatched/i })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /mark as unwatched/i })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/subjects/listening');
  await expect(page.getByText('2 of 3 classes watched')).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Classes completed').locator('..')).toContainText('4');
  await page.goto('/classes/listening-2');
  await page.getByRole('button', { name: /mark as unwatched/i }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /mark class as watched/i })).toHaveAttribute('aria-pressed', 'false');
});
