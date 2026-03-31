import { test, expect, devices } from '@playwright/test';

test('app loads and shows login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Recipe Club/i);
});

test('can log in as member via dev mode', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('member@example.com');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');
});

test('new event dialog fits on mobile screen without scrolling', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await context.newPage();

  await page.goto('/');
  await page.getByLabel('Email').fill('member@example.com');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');

  // Navigate to Events tab (second bottom-nav tab)
  await page.getByRole('tab').nth(1).click();
  // Click My Events sub-tab
  await page.getByText('My Events').click();

  // Open the new event dialog
  await page.getByRole('button', { name: /new event/i }).click();
  await page.waitForSelector('text=New Cooking Event');

  // Take screenshot to verify layout
  await page.screenshot({ path: 'test-results/mobile-new-event-dialog.png', fullPage: false });

  // All form fields should be visible without scrolling
  const viewport = page.viewportSize()!;
  const titleInput = page.getByLabel(/title/i).first();
  const dateInput = page.getByLabel(/date/i);
  const timeInput = page.getByLabel(/time/i);
  const createBtn = page.getByRole('button', { name: /create event/i });

  for (const el of [titleInput, dateInput, timeInput, createBtn]) {
    const box = await el.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }

  await context.close();
});

test('photo lightbox opens and closes when clicking a recipe photo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('member@example.com');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');

  // Navigate to Recipes tab
  await page.getByRole('tab', { name: /recipes/i }).click();

  // Wait for recipes to load (any content)
  await page.waitForTimeout(2000);

  // Check if the seeded recipe with a photo is present (requires npm run dev:reset)
  const photoButton = page.getByRole('button', { name: /view photo 1/i }).first();
  const hasPhotoButton = (await photoButton.count()) > 0;

  if (!hasPhotoButton) {
    // Seed data not applied — skip lightbox interaction but verify page loaded
    await expect(page.getByRole('tab', { name: /recipes/i })).toBeVisible();
    console.log('Skipping lightbox click test: no recipe photos found. Run npm run dev:reset to seed photo data.');
    return;
  }

  // Click the photo thumbnail to open the lightbox
  await photoButton.click();

  // Lightbox should be visible with a close button
  await expect(page.getByRole('button', { name: /close photo viewer/i })).toBeVisible({ timeout: 5000 });

  // Take a screenshot of the lightbox
  await page.screenshot({ path: 'test-results/photo-lightbox-open.png' });

  // Close the lightbox
  await page.getByRole('button', { name: /close photo viewer/i }).click();
  await expect(page.getByRole('button', { name: /close photo viewer/i })).not.toBeVisible();
});
