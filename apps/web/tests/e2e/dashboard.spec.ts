import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { skipIfPortalUnavailable } from './support/availability';

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Dashboard shell', () => {
  test.skip(adminEmail === '' || adminPassword === '', 'Admin credentials are required for dashboard shell tests.');

  test.beforeEach(async ({}, testInfo) => {
    await skipIfPortalUnavailable(testInfo);
  });

  test('shows navigation and status cards for authenticated admins', async ({ page }) => {
    await loginAsAdmin(page);

    const navigation = page.getByRole('navigation', { name: 'Primary' });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Connectors' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Calendars' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Logs' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Settings' })).toBeVisible();

    await expect(page.getByRole('status')).toHaveCount(3);
    await expect(page.getByRole('status', { name: 'Calendars Synced' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Connectors Healthy' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Active Alerts' })).toBeVisible();
  });

  test('collapses navigation into the mobile sheet at narrow viewports', async ({ page }) => {
    await loginAsAdmin(page);

    await page.setViewportSize({ width: 760, height: 900 });

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeHidden();

    const openNavButton = page.getByRole('button', { name: 'Open navigation' });
    await expect(openNavButton).toBeVisible();

    await openNavButton.click();
    const mobileDialog = page.locator('dialog#mobile-navigation');
    await expect(mobileDialog).toBeVisible();
    await expect(mobileDialog.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    await mobileDialog.getByRole('button', { name: 'Close' }).click();
    await expect(mobileDialog).toBeHidden();
  });

  test('passes axe-core critical accessibility checks and supports skip link focus order', async ({ page }) => {
    await loginAsAdmin(page);

    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const criticalViolations = results.violations.filter((violation) => violation.impact === 'critical');
    expect(criticalViolations).toHaveLength(0);
  });
});
