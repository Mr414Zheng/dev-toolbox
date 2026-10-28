import { defineConfig, devices } from '@playwright/test';

// 直接加载 file://，此验收配置故意不启动 webServer。
export default defineConfig({
  testDir: './tests/standalone',
  fullyParallel: true,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  outputDir: 'test-results-singlefile',
  reporter: [['list']],
  use: { offline: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
