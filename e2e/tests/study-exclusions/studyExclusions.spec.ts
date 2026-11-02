import { randomBytes } from 'crypto';
import { test, expect } from '@playwright/test';
import { AdminProtocolPage } from '../../pages/AdminProtocolPage';
import { AdminSubjectPage } from '../../pages/AdminSubjectPage';
import { SiteLoginPage } from '../../pages/SiteLoginPage';
import { SiteVerificationPage, VerificationInput } from '../../pages/SiteVerificationPage';
import { VctLoginPage } from '../../pages/VctLoginPage';
import { subjectNumber, syntheticName } from '../../fixtures/syntheticSubject';
import { addCalendarMonths, portalDate } from '../../fixtures/portalDate';

for (const scenario of [
  { name: 'Compound washout', screening: -75, dosing: -61, lastDosing: -60, completion: -59 },
  { name: 'Study lockout', screening: -385, dosing: -371, lastDosing: -370, completion: -1 },
]) {
  test(`${scenario.name} persists Verification Failure after a completed prior study`, async ({
    page, browser, baseURL,
  }, testInfo) => {
    test.skip(process.env.RUN_STUDY_EXCLUSIONS !== '1',
      'Set RUN_STUDY_EXCLUSIONS=1 only for approved synthetic QA enrollment creation and dating.');
    test.setTimeout(240000);
    expect(baseURL).toBe('https://qa-web-us.vctrials.com');
    expect(testInfo.retry).toBe(0);
    expect(testInfo.repeatEachIndex).toBe(0);
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    if (!username || !password) throw new Error('Set TEST_USERNAME and TEST_PASSWORD.');
    const today = portalDate();
    const dates = {
      screening: portalDate(scenario.screening), dosing: portalDate(scenario.dosing),
      lastDosing: portalDate(scenario.lastDosing), completion: portalDate(scenario.completion),
    };
    const prior: VerificationInput = {
      site: 'Test Site', protocol: 'AutoTest RA-Test Sponsor', location: 'Test Location 2',
      cohort: 'Acne Group', subjectNumber: subjectNumber(new Date()),
      firstName: syntheticName(), middleInitial: 'Z', lastName: syntheticName(),
      dateOfBirth: { day: '17', month: '4', year: '1988' }, gender: 'M', idType: 'P',
      idLastFive: randomBytes(3).toString('hex').slice(0, 5).toUpperCase(), termsAccepted: true,
    };
    await testInfo.attach('study-exclusion-input', {
      body: JSON.stringify({ synthetic: true, prior, dates, today, scenario: scenario.name,
        protocolSettingsChangedByTest: false }, null, 2), contentType: 'application/json',
    });
    const admin = await browser.newContext({ baseURL });
    const adminPage = await admin.newPage();
    const dialogs: string[] = [];
    for (const currentPage of [page, adminPage]) {
      currentPage.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });
    }
    try {
      await new VctLoginPage(adminPage).login(
        process.env.LEGACY_ADMIN_USERNAME ?? username,
        process.env.LEGACY_ADMIN_PASSWORD ?? password,
      );
      await new AdminProtocolPage(adminPage).expectWashoutPrerequisites();
      const subjects = new AdminSubjectPage(adminPage);
      await test.step('Create a fresh synthetic In Screening source through Admin', async () => {
        await subjects.createPriorStudy(prior, dates.screening);
      });
      const record = await test.step('Set Randomized, then Completed with actual LDD and LBDD', async () => {
        return subjects.completeCohortPriorStudy(prior, dates);
      });
      await testInfo.attach('completed-prior-study', {
        body: await adminPage.screenshot({ fullPage: true }), contentType: 'image/png',
      });
      const current: VerificationInput = {
        ...prior, site: 'Adams Clinical', protocol: 'AutoTest RA 2-Test Sponsor',
        location: '08053, TEST Location 3', cohort: 'NOT A DOSING/COHORT STUDY',
        subjectNumber: subjectNumber(new Date()),
      };
      expect(current.subjectNumber).not.toBe(prior.subjectNumber);
      await testInfo.attach('target-input', {
        body: JSON.stringify(current, null, 2), contentType: 'application/json',
      });
      expect(portalDate(), 'Do not submit after the portal calendar date changed').toEqual(today);
      await new SiteLoginPage(page).login(username, password, current.site);
      const verification = new SiteVerificationPage(page);
      await verification.open();
      await verification.fill(current);
      await page.locator('#ctl00_ContentPlaceHolder1_btnSave').click();
      const anchor = scenario.name === 'Compound washout' ? dates.lastDosing : dates.completion;
      const eligible = addCalendarMonths(anchor, scenario.name === 'Compound washout' ? 12 : 1);
      const month = eligible.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const eligibleDate = new RegExp(
        `${String(eligible.getUTCDate()).padStart(2, '0')}/${month}/${eligible.getUTCFullYear()}`, 'i',
      );
      if (scenario.name === 'Compound washout') {
        const alertText = await verification.rejectExclusionAlert(
          '12 Months washout from past exposure to TestCompound', eligibleDate,
        );
        await testInfo.attach('exclusion-alert', {
          body: alertText, contentType: 'text/plain',
        });
      }
      await expect(page.getByText(
        `${current.firstName} ${current.middleInitial} ${current.lastName} may not be eligible to screen for the AutoTest RA 2 study and is a Verification Failure.`,
        { exact: true },
      )).toBeVisible({ timeout: 45000 });
      if (scenario.name === 'Compound washout') {
        await expect(page.getByText('Please review the following violation:', { exact: true })).toBeVisible();
      } else {
        await expect(page.getByText(
          'Your study AutoTest RA 2 has a washout of 1 Months from last blood draw date to check-in / admission date.',
          { exact: false },
        )).toBeVisible();
        await expect(page.locator('body')).toContainText(eligibleDate);
        await expect(page.locator('body')).not.toContainText('TestCompound');
        await expect(page.getByText(/^Please review the following violation\./))
          .toBeVisible();
      }
      await expect(page.locator('body')).not.toContainText('CMP29');
      await expect(page.locator('body')).not.toContainText('has already screen failed');
      await expect(page.getByRole('link', {
        name: 'Download Subject Verification Certificate', exact: true,
      })).toBeVisible();
      expect(dialogs).toEqual([]);
      const targetRecord = await subjects.find(current, 'Verification Failure');
      expect(targetRecord.historyUrl).toBe(record.historyUrl);
      await subjects.find(prior, 'Completed');
    } finally {
      await testInfo.attach('site-result', {
        body: JSON.stringify({ url: page.url(), text: await page.locator('body').innerText(), dialogs },
          null, 2), contentType: 'application/json',
      });
      await testInfo.attach('site-screenshot', {
        body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
      });
      await testInfo.attach('admin-state', {
        body: await adminPage.screenshot({ fullPage: true }), contentType: 'image/png',
      });
      await admin.close();
    }
  });
}
