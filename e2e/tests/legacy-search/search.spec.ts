import { test, expect } from '@playwright/test';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { VctLoginPage } from '../../pages/VctLoginPage';

const scenarios = [
  {
    name: 'Sponsors',
    path: '/control/admin/managesponsor.aspx',
    searchButtonId: 'ctl00_ContentPlaceHolder1_btnSubmit',
    tableId: 'ctl00_ContentPlaceHolder1_grdSponsor',
    headers: ['', 'Company Name', 'Contact Name', 'Phone Number', 'Email', 'Is Active'],
    requiredColumns: [1],
    screenshot: 'sponsors-search-results.png',
  },
  {
    name: 'Research Sites',
    path: '/control/admin/adminresearchsites.aspx',
    searchButtonId: 'ctl00_ContentPlaceHolder1_btnSubmit',
    tableId: 'ctl00_ContentPlaceHolder1_grdSites',
    headers: ['', 'Research Site Name', 'Phone', 'Email', '# of Users', 'Verifications', 'Is Active'],
    requiredColumns: [1],
    screenshot: 'research-sites-search-results.png',
  },
  {
    name: 'Locations',
    path: '/control/admin/managelocation.aspx',
    searchButtonId: 'ctl00_ContentPlaceHolder1_btnSubmit',
    tableId: 'ctl00_ContentPlaceHolder1_grdLocation',
    headers: ['', 'Location Name', 'Site', 'Phone Number', 'Zip Code', 'VCT Notes', '# Verifications', 'Valid Geo'],
    requiredColumns: [1, 2],
    screenshot: 'locations-search-results.png',
  },
  {
    name: 'Sponsor Contacts',
    path: '/control/admin/managesponsorcontacts.aspx',
    searchButtonId: 'ctl00_ContentPlaceHolder1_btnSearch',
    tableId: 'ctl00_ContentPlaceHolder1_grdContact',
    headers: ['', 'Name', 'Title', 'Sponsor', 'Protocols', 'Email', 'Invited', 'Active', 'Trained', 'Edit'],
    requiredColumns: [1, 3, 5],
    screenshot: 'sponsor-contacts-search-results.png',
  },
  {
    name: 'Admin Users',
    path: '/control/admin/listadminusers.aspx',
    searchButtonId: 'ctl00_ContentPlaceHolder1_btnSubmit',
    tableId: 'ctl00_ContentPlaceHolder1_grdAdminUser',
    headers: ['Full Name', 'Group', 'Title', 'Email', 'Created On', 'Updated By', 'Modified On', 'Is Active'],
    requiredColumns: [0, 1, 3],
    screenshot: 'admin-users-search-results.png',
  },
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
