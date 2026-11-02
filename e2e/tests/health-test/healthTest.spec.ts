import { test, expect } from '@playwright/test';
import { HealthTestPage } from '../../pages/HealthTestPage';

function hasNoBiometrics(baseURL: string | undefined): boolean {
  return [
    'vctrialssamerica.com',
    'verifysubject.com',
    'qa-web-us.vctrials.com',
    'qa-us-admin.vct2.work',
  ].includes(new URL(baseURL ?? '').hostname);
}

test.describe('Health Test page — smoke tests', () => {
  let healthPage: HealthTestPage;

  test.beforeEach(async ({ page }) => {
    healthPage = new HealthTestPage(page);
    await healthPage.goto();
  });

  test.afterEach(async ({ page }, testInfo) => {
    const screenshot = testInfo.outputPath('health-result.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('health-result', {
      path: screenshot,
      contentType: 'image/png',
    });
  });

  test('Email test button triggers a result', async () => {
    await healthPage.clickAndWait(healthPage.emailTestButton);
    await expect(healthPage.emailTestResult).toBeVisible();
    await expect(healthPage.emailTestResult).toHaveText('Emails were sent');
  });

  test('Email attachment test button triggers a result', async () => {
    await healthPage.clickAndWait(healthPage.emailAttachmentButton);
    await expect(healthPage.emailAttachmentResult).toBeVisible();
    await expect(healthPage.emailAttachmentResult).toHaveText('Email was sent');
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

  test('Get biometric state button returns a message', async ({ baseURL }) => {
    test.skip(hasNoBiometrics(baseURL), 'Biometrics is not deployed in this environment.');
    await healthPage.clickAndWait(healthPage.biometricStateButton);
    await expect(healthPage.biometricStateResult).toBeVisible();

    const message = await healthPage.biometricStateResult.textContent();
    expect(message?.trim().length).toBeGreaterThan(0);

    console.log('Biometric state response:', message?.trim());
  });

  test('Check services health reports healthy services with explicit regional exceptions', async ({ baseURL }, testInfo) => {
    await expect(healthPage.servicesHealthButton).toBeVisible();
    await expect(healthPage.servicesHealthButton).toBeEnabled();
    await healthPage.clickAndWait(healthPage.servicesHealthButton);
    await expect(healthPage.servicesHealthTable).toBeVisible();

    const rows = healthPage.servicesHealthTable.locator('tr.gridtext');
    await expect(rows).toHaveCount(5);
    const results = await rows.evaluateAll((elements) =>
      elements.map((row) => {
        const cells = row.querySelectorAll('td');
        return {
          service: cells[0]?.textContent?.trim() ?? '',
          status: cells[1]?.textContent?.trim() ?? '',
          details: cells[2]?.textContent?.trim() ?? '',
        };
      }),
    );

    await testInfo.attach('services-health-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(results.map((result) => result.service)).toEqual([
      'Verification',
      'User Management',
      'Notification',
      'Protocol Synchronizer',
      'Biometric Matcher',
    ]);

    for (const result of results) {
      const isExpectedUnconfigured =
        result.service === 'Biometric Matcher' && hasNoBiometrics(baseURL);
      const allowedStatuses = isExpectedUnconfigured
        ? ['Healthy', 'Not configured']
        : ['Healthy'];
      console.log(
        `${result.service}: ${result.status}${isExpectedUnconfigured && result.status === 'Not configured' ? ' (expected: biometrics not deployed)' : ''}`,
      );
      expect.soft(
        allowedStatuses,
        `${result.service}: ${result.status}\n${result.details}`,
      ).toContain(result.status);
      if (result.status === 'Healthy') {
        expect.soft(result.details, `${result.service} returned no health details`).not.toBe('');
      }
    }
  });
});
