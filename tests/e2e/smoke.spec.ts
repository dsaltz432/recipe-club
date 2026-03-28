import { test, expect } from '@playwright/test';

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
