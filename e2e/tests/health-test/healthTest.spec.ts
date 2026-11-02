import { test, expect } from '@playwright/test';
import { HealthTestPage } from '../../pages/HealthTestPage';

test.describe('Health Test page — smoke tests', () => {
  let healthPage: HealthTestPage;

  test.beforeEach(async ({ page }) => {
    healthPage = new HealthTestPage(page);
    await healthPage.goto();
  });

  test('Email test button triggers a result', async () => {
    await healthPage.clickAndWait(healthPage.emailTestButton);
    await expect(healthPage.emailTestResult).toBeVisible();
    const result = await healthPage.emailTestResult.textContent();
    expect(result?.trim().length).toBeGreaterThan(0);
  });

  test('Email attachment test button triggers a result', async () => {
    await healthPage.clickAndWait(healthPage.emailAttachmentButton);
    await expect(healthPage.emailAttachmentResult).toBeVisible();
    const result = await healthPage.emailAttachmentResult.textContent();
    expect(result?.trim().length).toBeGreaterThan(0);
  });

  test('Test db context — all VCT_ rows end with "is fine."', async () => {
    await healthPage.clickAndWait(healthPage.testDbContextButton);
    await expect(healthPage.testDbContextResult).toBeVisible();

    const lines = await healthPage.getDbContextLines();
    const vctLines = lines.filter((line) => line.startsWith('VCT_'));

    expect(vctLines.length).toBeGreaterThan(0);

    for (const line of vctLines) {
      expect(line, `Expected "${line}" to end with "is fine."`).toMatch(/is fine\.$/);
    }
  });

  test('Get biometric state button returns a message', async () => {
    await healthPage.clickAndWait(healthPage.biometricStateButton);
    await expect(healthPage.biometricStateResult).toBeVisible();

    const message = await healthPage.biometricStateResult.textContent();
    expect(message?.trim().length).toBeGreaterThan(0);

    console.log('Biometric state response:', message?.trim());
  });

  test('Check services health button displays service statuses', async () => {
    await healthPage.clickAndWait(healthPage.servicesHealthButton);
    await expect(healthPage.servicesHealthResult).toBeVisible();

    const serviceRows = healthPage.servicesHealthResult.locator('tr.gridtext');
    await expect(serviceRows).not.toHaveCount(0);

    for (const row of await serviceRows.all()) {
      await expect(row.locator('td').nth(0)).not.toBeEmpty();
      await expect(row.locator('td').nth(1)).not.toBeEmpty();
    }
  });
});
