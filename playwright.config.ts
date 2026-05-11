import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 1,
  reporter: process.env.CI ? [['blob'], ['line']] : [['html'], ['line']],
});
