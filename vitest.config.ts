import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    environment: 'node',
    globals: true,
    setupFiles: []
  },
  resolve: {
    alias: {
      '@syncal/connectors': path.resolve(rootDir, 'packages/connectors/src/index.ts')
    }
  }
});
