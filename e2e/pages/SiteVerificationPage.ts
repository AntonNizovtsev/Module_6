import { Page, expect } from '@playwright/test';

declare const Sys: {
  WebForms: {
    PageRequestManager: {
      getInstance(): { get_isInAsyncPostBack(): boolean };
    };
  };
};

export interface VerificationInput {
  site: string;
  protocol: string;
  location: string;
  cohort: string;
  subjectNumber: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  dateOfBirth: { day: string; month: string; year: string };
  gender: string;
  idLastFive: string;
  idType: string;
  termsAccepted: boolean;
  biometricNotUsedReason?: string;
}

export class SiteVerificationPage {
  constructor(private readonly page: Page) {}

  private field(name: string) {
    return this.page.locator(`#ctl00_ContentPlaceHolder1_${name}`);
  }

  async open(): Promise<void> {
    await this.page.getByRole('link', { name: 'Verify Subject', exact: true }).click();
    await expect(this.field('ddlProtocols')).toBeVisible();
  }

  async fill(input: VerificationInput): Promise<void> {
    await this.selectWithPostback('#ctl00_ContentPlaceHolder1_ddlProtocols', input.protocol);
    await expect(this.field('ddlLocations').locator('option')).toContainText([input.location]);
    if (input.biometricNotUsedReason) {
      await this.selectWithPostback('#ddBiometricNotUsedReason', input.biometricNotUsedReason);
      await expect(this.page.locator('#ddBiometricNotUsedReason option:checked'))
        .toHaveText(input.biometricNotUsedReason);
    }
    await this.selectWithPostback('#ctl00_ContentPlaceHolder1_ddlLocations', input.location);
    await this.field('ddlCohorts').selectOption({ label: input.cohort });

    const textFields = {
      txtSubjectNumber: input.subjectNumber,
      txtFirstName: input.firstName,
      txtMiddleName: input.middleInitial,
      txtLastName: input.lastName,
      txtIDNo: input.idLastFive,
    };
    for (const [name, value] of Object.entries(textFields)) {
      await this.field(name).fill(value);
      await expect(this.field(name)).toHaveValue(value);
    }

    const selectFields = {
      ddlYear1_ddlDay: input.dateOfBirth.day,
      ddlYear1_ddlMonth: input.dateOfBirth.month,
      ddlYear1_ddlYear: input.dateOfBirth.year,
      ddlGender: input.gender,
      ddlID: input.idType,
    };
    for (const [name, value] of Object.entries(selectFields)) {
      await this.field(name).selectOption(value);
      await expect(this.field(name)).toHaveValue(value);
    }
    await this.field('chkTerms').setChecked(input.termsAccepted);
    for (const [name, value] of Object.entries(textFields)) {
      await expect(this.field(name)).toHaveValue(value);
    }
    await expect(this.field('chkTerms')).toBeChecked();
    await expect(this.field('ddlProtocols').locator('option:checked')).toHaveText(input.protocol);
    await expect(this.field('ddlLocations').locator('option:checked')).toHaveText(input.location);
    await expect(this.field('ddlCohorts').locator('option:checked')).toHaveText(input.cohort);
  }

  private async selectWithPostback(selector: string, label: string): Promise<void> {
    const url = new URL(this.page.url());
    url.hash = '';
    const [response] = await Promise.all([
      this.page.waitForResponse(result =>
        result.url() === url.href && result.request().method() === 'POST'),
      this.page.locator(selector).selectOption({ label }),
    ]);
    expect(response.ok(), `Postback failed for ${selector}`).toBeTruthy();
    await response.finished();
    await this.page.waitForFunction(() =>
      !Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack());
    await this.page.waitForLoadState('networkidle');
  }

  async submitAndExpectSuccess(input: VerificationInput): Promise<void> {
    await this.field('btnSave').click();
    await expect(this.page.getByText(
      `${input.firstName} ${input.middleInitial} ${input.lastName} has been Successfully Verified.`,
      { exact: true },
    )).toBeVisible({ timeout: 45000 });
    await expect(this.page.getByRole('link', {
      name: 'Download Subject Verification Certificate', exact: true,
    })).toBeVisible();
    await expect(this.page.getByRole('link', { name: 'New Verification', exact: true })).toBeVisible();
  }

  async rejectExclusionAlert(reason: string, eligibleDate: RegExp): Promise<string> {
    const alert = this.page.locator('#colorbox');
    await expect(alert).toBeVisible({ timeout: 45000 });
    await expect(alert).toContainText(reason);
    await expect(alert).toContainText(eligibleDate);
    const failure = alert.locator('input[type="radio"][value="2"]');
    await expect(failure, 'Expected one isolated exclusion alert').toHaveCount(1);
    await expect(alert.locator('input[type="radio"][value="1"]')).not.toBeChecked();
    const text = await alert.innerText();
    await failure.check();
    await alert.getByRole('button', { name: 'Proceed', exact: true }).click();
    await expect(alert).not.toBeVisible();
    return text;
  }
}
