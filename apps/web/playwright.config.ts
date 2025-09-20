import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const repoRoot = resolve(configDir, '..', '..');
const envFiles = ['.env', '.env.local', '.env.e2e.local'] as const;

for (const baseDir of [repoRoot, configDir]) {
  for (const file of envFiles) {
    const path = resolve(baseDir, file);

    if (existsSync(path)) {
      loadEnv({ path, override: file === '.env.e2e.local' });
    }
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
