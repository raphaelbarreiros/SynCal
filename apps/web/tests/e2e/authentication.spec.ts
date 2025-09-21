import { expect, test } from '@playwright/test';
import { skipIfPortalUnavailable } from './support/availability';

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

const authenticatedTest = adminEmail && adminPassword ? test : test.skip;

test.describe('Authentication flows', () => {
  test.beforeEach(async ({}, testInfo) => {
    await skipIfPortalUnavailable(testInfo);
  });

  test('redirects unauthenticated users to the login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(login)(\?|$)/);
  });

  authenticatedTest('allows an admin to sign in and sign out', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/(login)(\?|$)/);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/(login)(\?|$)/);
  });
});
