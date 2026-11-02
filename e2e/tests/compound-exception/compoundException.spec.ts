import { randomBytes } from 'crypto';
import { test, expect } from '@playwright/test';
import { AdminProtocolPage } from '../../pages/AdminProtocolPage';
import { AdminSubjectPage } from '../../pages/AdminSubjectPage';
import { SiteLoginPage } from '../../pages/SiteLoginPage';
import { SiteVerificationPage, VerificationInput } from '../../pages/SiteVerificationPage';
import { VctLoginPage } from '../../pages/VctLoginPage';
import { subjectNumber, syntheticName } from '../../fixtures/syntheticSubject';
import { portalDate } from '../../fixtures/portalDate';

for (const scenario of [
  { title: 'permits verification', elapsedDays: 30, succeeds: true },
  { title: 'rejects exact 29-day LDD boundary', elapsedDays: 29, succeeds: false },
]) {
  test(`Compound exception ${scenario.title} while prior study remains Randomized`, async ({
    page, browser, baseURL,
  }, testInfo) => {
    test.skip(process.env.RUN_COMPOUND_EXCEPTION !== '1',
      'Set RUN_COMPOUND_EXCEPTION=1 only after approval to create and date synthetic QA enrollments.');
    test.setTimeout(240000);
    expect(baseURL).toBe('https://qa-web-us.vctrials.com');
    expect(testInfo.retry, 'Persistent enrollment creation must not be retried').toBe(0);
    expect(testInfo.repeatEachIndex, 'Do not repeat persistent enrollment creation').toBe(0);
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    const adminUsername = process.env.LEGACY_ADMIN_USERNAME ?? username;
    const adminPassword = process.env.LEGACY_ADMIN_PASSWORD ?? password;
    if (!username || !password || !adminUsername || !adminPassword) {
      throw new Error('Set TEST_USERNAME / TEST_PASSWORD (and optionally LEGACY_ADMIN_USERNAME / LEGACY_ADMIN_PASSWORD).');
    }

    const verificationDate = portalDate(0);
    const dates = {
      screening: portalDate(-44), dosing: portalDate(-30),
      lastDosing: portalDate(-scenario.elapsedDays), completion: portalDate(31),
    };
    const prior: VerificationInput = {
      site: 'Adams Clinical',
      protocol: 'AutoTest RA 3-Test Sponsor',
      location: '08053, TEST Location 3',
      cohort: 'NOT A DOSING/COHORT STUDY',
      subjectNumber: subjectNumber(new Date()),
      firstName: syntheticName(),
      middleInitial: 'Z',
      lastName: syntheticName(),
      dateOfBirth: { day: '17', month: '4', year: '1988' },
      gender: 'M',
      idLastFive: randomBytes(3).toString('hex').slice(0, 5).toUpperCase(),
      idType: 'P',
      termsAccepted: true,
      biometricNotUsedReason: 'VCT Biometrics is not installed',
    };
    await testInfo.attach('compound-exception-input', {
      body: JSON.stringify({
        synthetic: true, prior, dates, verificationDate,
        elapsedDaysSinceLDD: scenario.elapsedDays,
        priorWashoutDays: 300, exceptionDays: 29, exceptionNumber: 'CMP29',
        protocolSettingsChangedByTest: false,
      }, null, 2),
      contentType: 'application/json',
    });
    const dialogs: string[] = [];
    const adminContext = await browser.newContext({ baseURL });
    const adminPage = await adminContext.newPage();
    for (const currentPage of [page, adminPage]) {
      currentPage.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });
    }

    try {
      await test.step('Read-only protocol prerequisites before creating any subject', async () => {
        await new VctLoginPage(adminPage).login(adminUsername, adminPassword);
        await new AdminProtocolPage(adminPage).expectCompoundExceptionPrerequisites();
      });
      const verification = new SiteVerificationPage(page);
      await test.step('Create a new synthetic B1 on RA3', async () => {
        await new SiteLoginPage(page).login(username, password, prior.site);
        await verification.open();
        await verification.fill(prior);
        await verification.submitAndExpectSuccess(prior);
      });
      const subjects = new AdminSubjectPage(adminPage);
      const priorRecord = await test.step(`Prepare and re-read Randomized B1 with LDD ${scenario.elapsedDays} days ago`, async () => {
        const record = await subjects.prepareRandomizedPriorStudy(prior, dates);
        await testInfo.attach('prior-randomized-dates', {
          body: await adminPage.screenshot({ fullPage: true }), contentType: 'image/png',
        });
        return record;
      });
      const current: VerificationInput = {
        ...prior, protocol: 'AutoTest RA 2-Test Sponsor',
        subjectNumber: subjectNumber(new Date()), biometricNotUsedReason: undefined,
      };
      expect(current.subjectNumber).not.toBe(prior.subjectNumber);
      await testInfo.attach('current-verification-input', {
        body: JSON.stringify(current, null, 2), contentType: 'application/json',
      });

      await test.step('Verify B2 and assert the exact compound exception outcome', async () => {
        expect(portalDate(0), 'Portal date changed; do not submit a different LDD boundary')
          .toEqual(verificationDate);
        await page.getByRole('link', { name: 'New Verification', exact: true }).click();
        await verification.fill(current);
        if (scenario.succeeds) {
          await verification.submitAndExpectSuccess(current);
          await expect(page.getByText(
            "Subject has previously been entered into VCT database but is not violating any of this study's exclusion criteria that VCT checks",
            { exact: true },
          )).toBeVisible();
        } else {
          await page.locator('#ctl00_ContentPlaceHolder1_btnSave').click();
          await expect(page.getByText(
            `${current.firstName} ${current.middleInitial} ${current.lastName} may not be eligible to screen for the AutoTest RA 2 study and is a Verification Failure.`,
            { exact: true },
          )).toBeVisible({ timeout: 45000 });
          await expect(page.getByText('Please review the following violation:', {
            exact: true,
          })).toBeVisible();
          await expect(page.getByText(
            "The subject's last dosing date was < 29 Days ago, and this dual enrollment may not be exclusion for the AutoTest RA 2 study. Please review exclusion criterion CMP29 and discuss eligibility for study entry with the Medical Monitor and study team. Should you have any questions, please contact VCT at 516-998-7499.",
            { exact: true },
          )).toBeVisible();
          await expect(page.locator('body')).not.toContainText('has already screen failed');
          await expect(page.getByRole('link', {
            name: 'Download Subject Verification Certificate', exact: true,
          })).toBeVisible();
          await expect(page.getByRole('link', { name: 'New Verification', exact: true })).toBeVisible();
        }
        expect(dialogs, 'Unexpected popup must not be silently approved').toEqual([]);
        await testInfo.attach('compound-exception-result', {
          body: JSON.stringify({
            url: page.url(), priorSubjectNumber: prior.subjectNumber,
            currentSubjectNumber: current.subjectNumber,
            text: await page.locator('body').innerText(), dates,
            elapsedDaysSinceLDD: scenario.elapsedDays, expectedSuccess: scenario.succeeds,
          }, null, 2),
          contentType: 'application/json',
        });
        await testInfo.attach('compound-exception-result-screenshot', {
          body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
        });
      });
      await test.step('Confirm both verifications belong to the same subject and B1 is still Randomized', async () => {
        const currentRecord = await subjects.find(current,
          scenario.succeeds ? 'In Screening' : 'Verification Failure');
        expect(currentRecord.historyUrl).toBe(priorRecord.historyUrl);
        await subjects.find(prior, 'Randomized');
      });
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('admin-failure-state', {
          body: await adminPage.screenshot({ fullPage: true }), contentType: 'image/png',
        });
      }
      await adminContext.close();
    }
  });
}
