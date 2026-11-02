import { test, expect } from '@playwright/test';
import { VctLoginPage } from '../../pages/VctLoginPage';
import { AdminProtocolPage } from '../../pages/AdminProtocolPage';

test('Admin — open verification protocol', async ({ page, baseURL }, testInfo) => {
  expect(new URL(baseURL!).hostname, 'Protocol inspection must run on QA US')
    .toBe('qa-web-us.vctrials.com');
  const username = process.env.LEGACY_ADMIN_USERNAME ?? process.env.TEST_USERNAME;
  const password = process.env.LEGACY_ADMIN_PASSWORD ?? process.env.TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('Set LEGACY_ADMIN_USERNAME / LEGACY_ADMIN_PASSWORD or TEST_USERNAME / TEST_PASSWORD.');
  }

  await new VctLoginPage(page).login(username, password);
  await expect(page).toHaveURL(/\/control\/admin\/admindashboard\.aspx/);
  const protocolPage = new AdminProtocolPage(page);
  await protocolPage.open('AutoTest RA 2', 'Test Sponsor');

  await testInfo.attach('opened-protocol', {
    body: JSON.stringify({
      url: page.url(),
      protocolName: await protocolPage.protocolName.inputValue(),
      protocolNumber: await protocolPage.protocolNumber.inputValue(),
      sponsor: await protocolPage.sponsor.locator('option:checked').innerText(),
      type: 'Rolling Admission',
      settingsChanged: false,
    }, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('protocol-screenshot', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});
