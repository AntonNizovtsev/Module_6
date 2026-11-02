import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import 'dotenv/config';

export const STORAGE_STATE = path.join(__dirname, 'playwright/.auth/user.json');
export const LEGACY_STORAGE_STATE = path.join(__dirname, 'playwright/.auth/legacy-admin.json');

const LEGACY_BASE_URL = process.env.LEGACY_BASE_URL ?? 'https://dev-web-us.vctrials.com';

export const PORTALS = {
  US:    process.env.US_PORTAL    ?? 'https://vctrials.com',
  EU:    process.env.EU_PORTAL    ?? 'https://vctrials.eu/',
  ASIA:  process.env.ASIA_PORTAL  ?? 'https://vctrials.asia/',
  LATAM: process.env.LATAM_PORTAL ?? 'https://vctrialssamerica.com/',
} as const;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://qa-us-admin.vct2.work',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    headless: true,
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    // ── Angular admin app ────────────────────────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: /sponsor-alert-report|site-verification|admin-protocol|compound-exception|study-exclusions/,
    },

    // ── Legacy ASP.NET admin app ─────────────────────────────────────────
    {
      name: 'legacy-admin-setup',
      testMatch: /legacy-admin-auth\.setup\.ts/,
      use: {
        baseURL: LEGACY_BASE_URL,
        actionTimeout: 20000,
        navigationTimeout: 45000,
      },
    },
    {
      name: 'legacy-admin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: LEGACY_BASE_URL,
        storageState: LEGACY_STORAGE_STATE,
        actionTimeout: 20000,
        navigationTimeout: 45000,
      },
      dependencies: ['legacy-admin-setup'],
      testMatch: /sponsor-alert-report/,
    },

    // ── Global API (Swagger UI) ──────────────────────────────────────────
    {
      name: 'global-api',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://api-v2.vct2.work',
        actionTimeout: 20000,
        navigationTimeout: 45000,
        ignoreHTTPSErrors: true,
      },
      testMatch: /global-api/,
    },
    {
      name: 'site-qa-chromium',
      testMatch: /site-verification/,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://qa-web-us.vctrials.com',
        storageState: { cookies: [], origins: [] },
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'compound-exception-qa-chromium',
      testMatch: /compound-exception/,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://qa-web-us.vctrials.com',
        storageState: { cookies: [], origins: [] },
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'study-exclusions-qa-chromium',
      testMatch: /study-exclusions/,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://qa-web-us.vctrials.com',
        storageState: { cookies: [], origins: [] },
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'admin-protocol-qa-chromium',
      testMatch: /admin-protocol/,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://qa-web-us.vctrials.com',
        storageState: { cookies: [], origins: [] },
        trace: 'retain-on-failure',
      },
    },
  ],
});
