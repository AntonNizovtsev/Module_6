import { test, expect } from '@playwright/test';
import { SubjectsPage } from '../../pages/SubjectsPage';
import { VctLoginPage } from '../../pages/VctLoginPage';

test('Subjects smoke: Search returns records without modifying subjects', async ({ page }, testInfo) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('Set TEST_USERNAME and TEST_PASSWORD before running the Subjects smoke test.');
  }

  await new VctLoginPage(page).login(username, password);
  const subjectsPage = new SubjectsPage(page);
  await subjectsPage.goto();
  await expect(page).toHaveURL(/\/control\/admin\/subjects\.aspx$/);
  await expect(subjectsPage.searchButton).toBeVisible();

  const response = await subjectsPage.search();
  expect(response.ok(), `Search response status: ${response.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/control\/admin\/subjects\.aspx$/);
  await expect(subjectsPage.resultsTable).toBeVisible();
  await expect(subjectsPage.resultsTable.locator('th')).toHaveText([
    '', 'Subject/Rand #', 'Name', 'DOB', 'Protocol Name',
    'Verification Date - By', 'Study Status - Date',
    'Update Status', 'Randomize Subject', 'Study History',
  ]);
  await expect(subjectsPage.subjectRows.first()).toBeVisible();
  expect(await subjectsPage.subjectRows.count()).toBeGreaterThan(0);
  const firstRow = subjectsPage.subjectRows.first();
  for (const column of [2, 4, 6]) {
    await expect(firstRow.locator('td').nth(column)).toHaveText(/\S/);
  }

  const screenshotPath = testInfo.outputPath('subjects-search-results.png');
  await subjectsPage.resultsTable.screenshot({ path: screenshotPath });
  await testInfo.attach('Subjects search results', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});
