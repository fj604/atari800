import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: './scripts/test-web.sh',
    port: 4173,
    reuseExistingServer: true,
    timeout: 10 * 60 * 1000,
  },
});
