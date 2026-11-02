import { randomBytes } from 'crypto';
import { test, expect } from '@playwright/test';
import { AdminProtocolPage } from '../../pages/AdminProtocolPage';
import { AdminSubjectPage } from '../../pages/AdminSubjectPage';
import { SiteLoginPage } from '../../pages/SiteLoginPage';
import { SiteVerificationPage, VerificationInput } from '../../pages/SiteVerificationPage';
import { VctLoginPage } from '../../pages/VctLoginPage';
import { subjectNumber, syntheticName } from '../../fixtures/syntheticSubject';

test('Age above inclusive maximum is a persisted Verification Failure', async ({
  page, browser, baseURL,
}, testInfo) => {
  expect(baseURL).toBe('https://qa-web-us.vctrials.com');
  expect(testInfo.retry).toBe(0);
  expect(testInfo.repeatEachIndex).toBe(0);
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) throw new Error('Set TEST_USERNAME and TEST_PASSWORD.');
  const admin = await browser.newContext({ baseURL });
  const adminPage = await admin.newPage();
  try {
    await new VctLoginPage(adminPage).login(
      process.env.LEGACY_ADMIN_USERNAME ?? username,
      process.env.LEGACY_ADMIN_PASSWORD ?? password,
    );
    await new AdminProtocolPage(adminPage).open('AutoTest RA 2', 'Test Sponsor');
    const prefix = '#ctl00_ContentPlaceHolder1_pnlProtocol_';
    await expect(adminPage.locator(`${prefix}txtFromRange`)).toHaveValue('1');
    await expect(adminPage.locator(`${prefix}txtToRange`)).toHaveValue('99');
    const portalYear = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Etc/GMT+5', year: 'numeric',
    }).format(new Date()));
    const input: VerificationInput = {
      site: 'Adams Clinical', protocol: 'AutoTest RA 2-Test Sponsor',
      location: '08053, TEST Location 3', cohort: 'NOT A DOSING/COHORT STUDY',
      subjectNumber: subjectNumber(new Date()),
      firstName: syntheticName(), middleInitial: 'Z', lastName: syntheticName(),
      dateOfBirth: { day: '1', month: '1', year: String(portalYear - 100) },
      gender: 'M', idType: 'P',
      idLastFive: randomBytes(3).toString('hex').slice(0, 5).toUpperCase(),
      termsAccepted: true,
    };
    await testInfo.attach('age-input', {
      body: JSON.stringify({ baseURL, synthetic: true, input, age: 100, bounds: [1, 99] }, null, 2),
      contentType: 'application/json',
    });
    const dialogs: string[] = [];
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await new SiteLoginPage(page).login(username, password, input.site);
    const verification = new SiteVerificationPage(page);
    await verification.open();
    await verification.fill(input);
    await page.locator('#ctl00_ContentPlaceHolder1_btnSave').click();
    await expect(page.getByText(
      `${input.firstName} ${input.middleInitial} ${input.lastName} may not be eligible to screen for the AutoTest RA 2 study and is a Verification Failure.`,
      { exact: true },
    )).toBeVisible({ timeout: 45000 });
    await expect(page.getByText('Please review the following violation:', { exact: true })).toBeVisible();
    await expect(page.getByText(
      `Subject (#${input.subjectNumber}) may not be eligible to screen for the AutoTest RA 2 trial. The subject's age may not be valid for this study. You entered 01/Jan/${input.dateOfBirth.year}. Protocol AutoTest RA 2 requires age range 1 - 99. Please double-check their DOB per their valid ID. To confirm and discuss subject eligibility, please reach out to your study team before proceeding with this screening visit.`,
      { exact: true },
    )).toBeVisible();
    await expect(page.getByRole('link', {
      name: 'Download Subject Verification Certificate', exact: true,
    })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Verification', exact: true })).toBeVisible();
    expect(dialogs).toEqual([]);
    await testInfo.attach('age-result', {
      body: JSON.stringify({ subjectNumber: input.subjectNumber, url: page.url(),
        text: await page.locator('body').innerText() }, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('age-result-screenshot', {
      body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
    });
    await new AdminSubjectPage(adminPage).find(input, 'Verification Failure');
  } finally {
    await admin.close();
  }
});
