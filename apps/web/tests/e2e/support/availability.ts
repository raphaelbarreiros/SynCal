import type { TestInfo } from '@playwright/test';

export async function skipIfPortalUnavailable(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000';

  try {
    const response = await fetch(baseURL, { method: 'GET' });

    if (!response.ok && response.status !== 302) {
      throw new Error(`Unexpected response (status ${response.status})`);
    }
  } catch (error) {
    testInfo.skip(
      true,
      `Portal is not reachable at ${baseURL}. Start the web app or set E2E_BASE_URL before running E2E tests.`
    );
  }
}
