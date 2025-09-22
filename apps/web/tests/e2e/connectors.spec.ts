import { expect, test, type Page } from '@playwright/test';
import { skipIfPortalUnavailable } from './support/availability';

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/(login)(\?|$)/);
}

test.describe('Connector wizard', () => {
  test.skip(adminEmail === '' || adminPassword === '', 'Admin credentials are required for connector wizard tests.');

  test.beforeEach(async ({ page }, testInfo) => {
    await skipIfPortalUnavailable(testInfo);
    await loginAsAdmin(page);

    await page.addInitScript(() => {
      const assigned: string[] = [];
      (window as unknown as { __assignedUrls: string[] }).__assignedUrls = assigned;
      window.location.assign = (url: string | URL) => {
        assigned.push(String(url));
      };
    });
  });

  test('completes Google connector onboarding with validation summary', async ({ page }) => {
    let issuedState = '';
    let contextEntries: Array<Record<string, unknown>> = [];
    let connectorsResponse: { connectors: Array<Record<string, unknown>> } = {
      connectors: []
    };

    await page.route('**/auth/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'csrf-token' })
      });
    });

    await page.route('**/auth/oauth/context', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: contextEntries })
      });
    });

    await page.route('**/connectors', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(connectorsResponse)
        });
        return;
      }

      const payload = route.request().postDataJSON() as {
        type: string;
        state: string;
        selectedCalendars: Array<{ providerCalendarId: string }>;
      };

      expect(payload.type).toBe('google');
      expect(payload.selectedCalendars[0]?.providerCalendarId).toBe('cal-primary');
      expect(route.request().headers()['x-csrf-token']).toBe('csrf-token');

      const createdAt = new Date().toISOString();
      const connector = {
        id: '00000000-0000-0000-0000-000000001000',
        type: 'google',
        displayName: 'Marketing Google Workspace',
        status: 'validated',
        lastValidatedAt: createdAt,
        calendars: [
          {
            id: '00000000-0000-0000-0000-000000001111',
            providerCalendarId: 'cal-primary',
            displayName: 'Marketing',
            privacyMode: 'busy_placeholder',
            metadata: {}
          }
        ],
        config: {
          validation: {
            status: 'success',
            checkedAt: createdAt,
            samples: [
              {
                calendarId: 'cal-primary',
                total: 3,
                from: createdAt,
                to: createdAt
              }
            ]
          }
        },
        createdAt,
        updatedAt: createdAt
      };

      connectorsResponse = { connectors: [connector] };
      contextEntries = [];

      await route.fulfill({
        status: 201,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(connector)
      });
    });

    await page.route('**/auth/oauth/start', async (route) => {
      const state = `state-${Date.now()}`;
      issuedState = state;
      contextEntries = [
        {
          provider: 'google',
          state,
          profile: {
            id: 'user-1',
            email: 'admin@example.com',
            name: 'Calendar Admin'
          },
          scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar'],
          discoveredCalendars: [
            {
              id: 'cal-primary',
              name: 'Primary',
              description: 'Main workspace calendar',
              timeZone: 'UTC',
              isPrimary: true,
              canEdit: true
            }
          ]
        }
      ];

      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          authorizationUrl: `https://auth.example.test?state=${state}`,
          state
        })
      });
    });

    const connectorsResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/connectors') && response.request().method() === 'GET'
    );
    const contextResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/auth/oauth/context') && response.request().method() === 'GET'
    );

    await page.goto(`/connectors?provider=google&status=success&state=${issuedState}`);
    await Promise.all([connectorsResponsePromise, contextResponsePromise]);

    await expect(page.getByRole('heading', { name: 'Select calendars to sync' })).toBeVisible();
    await expect(page.getByLabel('Connector display name')).toBeVisible();

    await page.getByLabel('Connector display name').fill('Marketing Google Workspace');
    await page.getByRole('button', { name: 'Complete setup' }).click();

    await expect(
      page.getByText('Connector Marketing Google Workspace is ready.', { exact: false })
    ).toBeVisible();

    await expect(page.getByRole('cell', { name: 'google' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'validated' })).toBeVisible();
  });

  test('surfaces OAuth error state inline', async ({ page }) => {
    let contextEntries: Array<Record<string, unknown>> = [];
    const connectorsResponse = { connectors: [] as Array<Record<string, unknown>> };

    await page.route('**/auth/oauth/context', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: contextEntries })
      });
    });

    await page.route('**/connectors', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(connectorsResponse)
      });
    });

    const connectorsErrorPromise = page.waitForResponse((response) =>
      response.url().includes('/connectors') && response.request().method() === 'GET'
    );
    const contextErrorPromise = page.waitForResponse((response) =>
      response.url().includes('/auth/oauth/context') && response.request().method() === 'GET'
    );

    await page.goto('/connectors?provider=google&status=error');
    await Promise.all([connectorsErrorPromise, contextErrorPromise]);

    await expect(
      page.getByText('Authorization was cancelled or failed. Please try again.')
    ).toBeVisible();
  });
});
