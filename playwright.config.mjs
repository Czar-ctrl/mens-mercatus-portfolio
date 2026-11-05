import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
  },
  webServer: {
    command: 'npx --yes serve preview -l 4173',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  reporter: [['list'], ['json', { outputFile: 'proof/after/playwright-results.json' }]],
});
