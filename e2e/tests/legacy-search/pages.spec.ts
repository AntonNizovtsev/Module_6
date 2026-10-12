import { test, expect } from '@playwright/test';
import { VctLoginPage } from '../../pages/VctLoginPage';

test.beforeEach(async ({ page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('Set TEST_USERNAME and TEST_PASSWORD before running read-only page smoke tests.');
  }
  await new VctLoginPage(page).login(username, password);
});

test('Dashboard smoke: main links open read-only pages', async ({ page }, testInfo) => {
  const dashboardPath = '/control/admin/admindashboard.aspx';
  const dashboardUrl = new URL(dashboardPath, page.url()).href;
  const response = await page.goto(dashboardPath);
  expect(response?.ok(), 'Dashboard must return a successful response').toBeTruthy();
  await expect(page).toHaveURL(dashboardUrl);
  await expect(page.getByText('ADMIN DASHBOARD', { exact: true })).toBeVisible();

  const screenshotPath = testInfo.outputPath('dashboard.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('Admin Dashboard', { path: screenshotPath, contentType: 'image/png' });

  for (const destination of [
    { file: 'listadminusers.aspx', control: '#ctl00_ContentPlaceHolder1_btnSubmit' },
    { file: 'subjects.aspx', control: '#ctl00_ContentPlaceHolder1_btnSearch' },
    { file: 'manageReports.aspx', control: 'a[href="verification_alerts_report.aspx"]:not([id^="menuItem"])' },
  ]) {
    const link = page.locator(`a[href="${destination.file}"]`).filter({
      hasText: /Manage/,
    }).last();
    await expect(link).toBeVisible();
    const [navigation] = await Promise.all([
      page.waitForResponse(response =>
        response.request().isNavigationRequest() &&
        new URL(response.url()).pathname === `/control/admin/${destination.file}`
      ),
      link.click(),
    ]);
    expect(navigation.ok(), `${destination.file} must return a successful response`).toBeTruthy();
    await expect(page).toHaveURL(new URL(destination.file, dashboardUrl).href);
    await expect(page.locator(destination.control).first()).toBeVisible();
    await page.goto(dashboardPath);
    await expect(page).toHaveURL(dashboardUrl);
  }
});

test('Report Waiting smoke: existing reports and statuses are displayed without submitting a report', async ({ page }, testInfo) => {
  const reportPath = '/control/admin/adminreportwaitlist.aspx';
  const expectedUrl = new URL(reportPath, page.url()).href;
  const response = await page.goto(reportPath);
  expect(response?.ok(), 'Report Waiting must return a successful response').toBeTruthy();
  await expect(page).toHaveURL(expectedUrl);
  const table = page.locator('table.fieldtext').filter({ has: page.locator('th') });
  await expect(table).toBeVisible();
  await expect(table.locator('th')).toHaveText([
    '#', 'Sponsor Name', 'Protocol Name(s)', 'Report Name', 'Started On', 'Status', 'Export Type', '', '',
  ]);
  const rows = table.locator('tr[align="center"]');
  for (let index = 0; index < await rows.count(); index++) {
    const row = rows.nth(index);
    await expect(row.locator('span[id$="_txtNum"]')).toHaveText(/^\d+$/);
    await expect(row.locator('span[id$="_txtrReportName"]')).toHaveText(/\S/);
    await expect(row.locator('td').nth(4)).toHaveText(/\S/);
    await expect(row.locator('span[id$="_txtReportStatus"]')).toHaveText(/\S/);
  }
  const screenshotPath = testInfo.outputPath('report-waiting.png');
  await table.screenshot({ path: screenshotPath });
  await testInfo.attach('Existing reports', { path: screenshotPath, contentType: 'image/png' });
});
