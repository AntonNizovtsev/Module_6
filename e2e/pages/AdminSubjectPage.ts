import { Page, expect } from '@playwright/test';
import { VerificationInput } from './SiteVerificationPage';

export interface CalendarDate {
  day: string;
  month: string;
  year: string;
}

export interface PriorStudyDates {
  screening: CalendarDate;
  dosing: CalendarDate;
  lastDosing: CalendarDate;
  completion: CalendarDate;
}

export interface SubjectRecord {
  historyUrl: string;
  scheduleUrl: string | null;
}

export class AdminSubjectPage {
  constructor(private readonly page: Page) {}

  private field(name: string) {
    return this.page.locator(`#ctl00_ContentPlaceHolder1_${name}`);
  }

  private assertSyntheticQa(input: VerificationInput): void {
    expect(new URL(this.page.url()).origin).toBe('https://qa-web-us.vctrials.com');
    expect(input.subjectNumber).toMatch(/^Auto-\d{6}-\d{6}$/);
    expect(['AutoTest RA 3-Test Sponsor', 'AutoTest RA-Test Sponsor']).toContain(input.protocol);
  }

  private async date(name: string, value: CalendarDate, fill: boolean): Promise<void> {
    for (const [suffix, part] of [
      ['ddlYear', value.year], ['ddlMonth', value.month], ['ddlDay', value.day],
    ]) {
      if (fill) await this.field(`${name}_${suffix}`).selectOption(part);
      await expect(this.field(`${name}_${suffix}`)).toHaveValue(part);
    }
  }

  async find(input: VerificationInput, status: 'In Screening' | 'Randomized' | 'Completed' | 'Verification Failure'): Promise<SubjectRecord> {
    await this.page.goto('/control/admin/subjects.aspx');
    await this.field('txtSubjectNumber').fill(input.subjectNumber);
    await this.field('btnSearch').click();
    const protocol = input.protocol.replace(/-Test Sponsor$/, '');
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const protocolLabel = new RegExp(`^${escape(protocol)}(?: - Cohort -?\\d+| - ${escape(input.cohort)})?$`);
    const row = this.page.locator('#ctl00_ContentPlaceHolder1_grdSubjects > tbody > tr')
      .filter({ hasText: input.subjectNumber })
      .filter({ has: this.page.getByRole('cell', { name: protocolLabel }) })
      .filter({ has: this.page.getByRole('link', {
        name: `${input.firstName} ${input.middleInitial} ${input.lastName}`, exact: true,
      }) });
    await expect(row, 'Expected exactly the newly created synthetic verification').toHaveCount(1);
    await expect(row).toContainText(`${status} -`);
    const history = await row.getByRole('link', { name: 'View', exact: true }).getAttribute('href');
    const scheduleLink = row.getByRole('link', { name: 'Click Here', exact: true });
    const schedule = await scheduleLink.count() === 1 ? await scheduleLink.getAttribute('href') : null;
    if (!history) throw new Error('Synthetic subject history link is missing.');
    const historyUrl = new URL(history, this.page.url()).href;
    const scheduleUrl = schedule ? new URL(schedule, this.page.url()).href : null;
    expect(new URL(historyUrl).origin).toBe('https://qa-web-us.vctrials.com');
    if (scheduleUrl) expect(new URL(scheduleUrl).origin).toBe('https://qa-web-us.vctrials.com');
    if (status !== 'Verification Failure' && status !== 'Completed' && !scheduleUrl) {
      throw new Error('Synthetic subject schedule link is missing.');
    }

    return { historyUrl, scheduleUrl };
  }

  private async postback(action: () => Promise<unknown>): Promise<void> {
    const url = new URL(this.page.url());
    const [response] = await Promise.all([
      this.page.waitForResponse(result => {
        const actual = new URL(result.url());
        return actual.origin === url.origin && actual.pathname === url.pathname
          && result.request().method() === 'POST';
      }),
      action(),
    ]);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);
    await response.finished();
    await this.page.waitForLoadState('networkidle');
  }

  async createPriorStudy(input: VerificationInput, screening: CalendarDate): Promise<SubjectRecord> {
    this.assertSyntheticQa(input);
    expect(input.protocol).toBe('AutoTest RA-Test Sponsor');
    await this.page.goto('/control/admin/createEditVerification.aspx');
    for (const [field, label] of [
      ['ddlProtocols', input.protocol], ['ddlSites', input.site],
      ['ddlLocations', input.location],
    ]) {
      await this.postback(() => this.field(field).selectOption({ label }));
    }
    await this.field('ddlCohorts').selectOption({ label: input.cohort });
    for (const [name, value] of [
      ['txtSubjectNumber', input.subjectNumber], ['txtFirstName', input.firstName],
      ['txtMiddleName', input.middleInitial], ['txtLastName', input.lastName],
      ['txtIDNo', input.idLastFive],
    ]) await this.field(name).fill(value);
    await this.field('ddlStatus').selectOption('In Screening');
    await this.field('ddlGender').selectOption(input.gender);
    await this.field('ddlID').selectOption(input.idType);
    await this.date('ddlDob', input.dateOfBirth, true);
    await this.date('ddlVerificationDate', screening, true);
    await this.postback(() => this.field('btnSave').click());
    return this.find(input, 'In Screening');
  }

  async randomizeCohortPriorStudy(input: VerificationInput, dates: PriorStudyDates): Promise<SubjectRecord> {
    this.assertSyntheticQa(input);
    expect(input.protocol).toBe('AutoTest RA-Test Sponsor');
    const record = await this.find(input, 'In Screening');
    if (!record.scheduleUrl) throw new Error('Fresh synthetic subject has no schedule link.');
    await this.page.goto(record.scheduleUrl);
    await expect(this.field('lblVerificationDate')).toHaveText(this.displayDate(dates.screening));
    await this.date('ddlRandom', dates.dosing, true);
    await this.date('ddlCohortLastDosing', dates.lastDosing, true);
    await this.date('ddlCohortLastBloodDrawDate', dates.completion, true);
    await this.date('ddlCohortDischarge', dates.completion, true);
    await this.field('chkTurnOffAutoComplete').check();
    await this.field('btnSubmit').click();
    await expect(this.page.getByText("Subject's Visit Schedule updated successfully", { exact: true }))
      .toBeVisible();
    await this.find(input, 'Randomized');
    return record;
  }

  async completeCohortPriorStudy(input: VerificationInput, dates: PriorStudyDates): Promise<SubjectRecord> {
    const record = await this.randomizeCohortPriorStudy(input, dates);
    await this.page.locator('#ctl00_ContentPlaceHolder1_grdSubjects a[href*="updatesubjectstatus.aspx"]')
      .click();
    await this.field('rbtnComplete').check();
    await this.date('ddlCompletedDate', dates.completion, true);
    await this.date('ddlCompletedDosingDate', dates.lastDosing, true);
    await this.date('ddlCompletedLBDDate', dates.completion, true);
    await this.field('txtComment').fill('Synthetic QA automation: completed prior-study eligibility fixture.');
    await this.postback(() => this.field('btnSubmit').click());
    await this.find(input, 'Completed');
    await this.page.goto(record.historyUrl);
    await this.page.getByText('View Dosing Dates', { exact: true }).click();
    for (const [label, value] of [
      ['Last Dosing Date', dates.lastDosing],
      ['Last Blood Draw Date', dates.completion],
      ['Study Completion Date', dates.completion],
    ] as const) {
      await expect(this.page.getByText(label, { exact: true })
        .locator('xpath=following-sibling::span[1]')).toHaveText(this.displayDate(value));
    }
    return record;
  }

  async prepareRandomizedPriorStudy(input: VerificationInput, dates: PriorStudyDates): Promise<SubjectRecord> {
    this.assertSyntheticQa(input);
    const record = await this.find(input, 'In Screening');
    const scheduleUrl = record.scheduleUrl;
    if (!scheduleUrl) throw new Error('Fresh synthetic subject has no schedule link.');
    await this.page.goto(record.historyUrl);
    const edit = this.page.locator('a[href*="createEditVerification.aspx?vid="]');
    await expect(edit, 'The fresh subject must have only B1 before preparation').toHaveCount(1);
    await edit.click();
    await expect(this.field('txtSubjectNumber')).toHaveValue(input.subjectNumber);
    await expect(this.field('txtFirstName')).toHaveValue(input.firstName);
    await expect(this.field('txtLastName')).toHaveValue(input.lastName);
    await expect(this.field('txtIDNo')).toHaveValue(input.idLastFive);
    await expect(this.field('ddlGender')).toHaveValue(input.gender);
    await expect(this.field('ddlID')).toHaveValue(input.idType);
    await this.date('ddlDob', input.dateOfBirth, false);
    // The legacy editor leaves this optional field blank when loading a verification.
    await this.field('txtMiddleName').fill(input.middleInitial);
    await this.date('ddlVerificationDate', dates.screening, true);
    await this.field('btnSave').click();
    await expect(this.page.getByText('Verification successfuly updated.', { exact: false })).toBeVisible();

    await this.page.goto(scheduleUrl);
    await expect(this.field('lblVerificationDate')).toHaveText(this.displayDate(dates.screening));
    await this.date('ddlRandom', dates.dosing, true);
    await this.date('ddlLastDosing', dates.lastDosing, true);
    await this.date('ddlLastBloodDrawDate', dates.completion, true);
    await this.date('ddlDischargeDate', dates.completion, true);
    await this.field('chkTurnOffAutoComplete').check();
    await this.field('btnSubmit').click();
    await expect(this.page.getByText("Subject's Visit Schedule updated successfully", { exact: true }))
      .toBeVisible();

    await this.page.goto(scheduleUrl);
    await this.date('ddlRandom', dates.dosing, false);
    await this.date('ddlLastDosing', dates.lastDosing, false);
    await this.date('ddlLastBloodDrawDate', dates.completion, false);
    await this.date('ddlDischargeDate', dates.completion, false);
    await expect(this.field('chkTurnOffAutoComplete')).toBeChecked();
    await this.find(input, 'Randomized');
    await this.page.goto(scheduleUrl);
    return record;
  }

  private displayDate(date: CalendarDate): string {
    const month = new Date(Date.UTC(Number(date.year), Number(date.month) - 1, Number(date.day)))
      .toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    return `${date.day.padStart(2, '0')}/${month}/${date.year}`;
  }
}
