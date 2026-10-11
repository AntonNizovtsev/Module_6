import { test, expect } from '@playwright/test';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { VctLoginPage } from '../../pages/VctLoginPage';

const scenarios = [
  {
    name: 'Protocols',
    path: '/control/admin/protocollist.aspx',
    searchButtonId: 'ctl00_ContentPlaceHolder1_btnSubmit',
    tableId: 'ctl00_ContentPlaceHolder1_grdProtocols',
    headers: [
      '', 'Protocol Name', 'Protocol Number', 'Sponsor', 'Health Conditions',
      'Type', 'Is Cohort', 'Date Added', 'Verifications', '# Active',
    ],
    requiredColumns: [1, 3, 5, 7],
    screenshot: 'protocols-search-results.png',
  },
  {
    name: 'Site Contacts',
    path: '/control/admin/managesitecontacts.aspx',
    searchButtonId: 'ctl00_ContentPlaceHolder1_btnSearch',
    tableId: 'ctl00_ContentPlaceHolder1_grdContact',
    headers: [
      '', 'Name', 'Site / Loc', 'Sponsor Name', 'Protocol Name', 'Email',
      'PI', 'Active', 'Trained', 'Date Added', 'Edit',
    ],
    requiredColumns: [1, 2, 5, 9],
    screenshot: 'site-contacts-search-results.png',
  },
];

for (const scenario of scenarios) {
  test(`${scenario.name} smoke: Search returns records without modifying data`, async ({ page }, testInfo) => {
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    if (!username || !password) {
      throw new Error('Set TEST_USERNAME and TEST_PASSWORD before running read-only search smoke tests.');
    }

    await new VctLoginPage(page).login(username, password);
    const searchPage = new SearchResultsPage(
      page, scenario.path, scenario.searchButtonId, scenario.tableId, scenario.headers.length,
    );
    await searchPage.goto();
    const expectedUrl = new URL(scenario.path, page.url()).href;
    await expect(page).toHaveURL(expectedUrl);
    await expect(searchPage.searchButton).toBeVisible();

    const response = await searchPage.search();
    expect(response.ok(), `Search response status: ${response.status()}`).toBeTruthy();
    await expect(page).toHaveURL(expectedUrl);
    await expect(searchPage.resultsTable).toBeVisible();
    await expect(searchPage.resultsTable.locator('th')).toHaveText(scenario.headers);
    await expect(searchPage.recordRows.first()).toBeVisible();
    expect(await searchPage.recordRows.count()).toBeGreaterThan(0);
    for (const column of scenario.requiredColumns) {
      await expect(searchPage.recordRows.first().locator('td').nth(column)).toHaveText(/\S/);
    }

    const screenshotPath = testInfo.outputPath(scenario.screenshot);
    await searchPage.resultsTable.screenshot({ path: screenshotPath });
    await testInfo.attach(`${scenario.name} search results`, {
      path: screenshotPath,
      contentType: 'image/png',
    });
  });
}
