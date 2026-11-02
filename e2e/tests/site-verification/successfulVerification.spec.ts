import { randomBytes } from 'crypto';
import { writeFile } from 'fs/promises';
import { test, expect } from '@playwright/test';
import { SiteLoginPage } from '../../pages/SiteLoginPage';
import { SiteVerificationPage, VerificationInput } from '../../pages/SiteVerificationPage';
import { subjectNumber, syntheticName } from '../../fixtures/syntheticSubject';

test('Happy path — successful site verification', async ({ page, baseURL }, testInfo) => {
  expect(new URL(baseURL!).hostname, 'This test creates a subject and must run on QA US only')
    .toBe('qa-web-us.vctrials.com');
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('Set TEST_USERNAME and TEST_PASSWORD before running the site verification test.');
  }

  const input: VerificationInput = {
    site: 'Adams Clinical',
    protocol: 'AutoTest RA 2-Test Sponsor',
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
  };
  const inputPath = testInfo.outputPath('verification-input.json');
  await writeFile(inputPath, JSON.stringify({ baseURL, synthetic: true, ...input }, null, 2));
  await testInfo.attach('verification-input', { path: inputPath, contentType: 'application/json' });

  const dialogs: string[] = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await new SiteLoginPage(page).login(username, password, input.site);
  const verification = new SiteVerificationPage(page);
  await verification.open();
  await verification.fill(input);
  await verification.submitAndExpectSuccess(input);
  expect(dialogs, 'Unexpected dialog in the successful happy path').toEqual([]);

  await testInfo.attach('verification-result', {
    body: JSON.stringify({
      url: page.url(),
      subjectNumber: input.subjectNumber,
      message: `${input.firstName} ${input.middleInitial} ${input.lastName} has been Successfully Verified.`,
      dialogs,
    }, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('verification-result-screenshot', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});
