import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pwa',
  fullyParallel: true,
  workers: 3,
  timeout: 60_000,
  outputDir: '.artifacts/pwa-results',
  reporter: [['list'], ['html', { outputFolder: '.artifacts/pwa-report', open: 'never' }]],
  use: {
    locale: 'en-US',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...(['chromium', 'firefox', 'webkit'] as const).map((browserName) => ({
      name: `pwa-${browserName}`,
      testIgnore: '**/base.spec.ts',
      use: {
        ...devices[
          browserName === 'chromium'
            ? 'Desktop Chrome'
            : browserName === 'firefox'
              ? 'Desktop Firefox'
              : 'Desktop Safari'
        ],
        baseURL: 'http://127.0.0.1:4175',
      },
    })),
    ...(['chromium', 'firefox', 'webkit'] as const).map((browserName) => ({
      name: `pages-${browserName}`,
      testMatch: '**/base.spec.ts',
      use: {
        ...devices[
          browserName === 'chromium'
            ? 'Desktop Chrome'
            : browserName === 'firefox'
              ? 'Desktop Firefox'
              : 'Desktop Safari'
        ],
        baseURL: 'http://127.0.0.1:4176/Tebikae/',
      },
    })),
  ],
  webServer: [
    {
      command: 'pnpm preview --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'pnpm exec vite preview --host 127.0.0.1 --port 4176 --strictPort --outDir .artifacts/pages-dist --base /Tebikae/',
      url: 'http://127.0.0.1:4176/Tebikae/',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
