import { Page, Locator } from '@playwright/test';
import { VctLoginPage } from './VctLoginPage';

export class HealthTestPage {
  readonly url = '/control/admin/healthtest.aspx';

  readonly emailTestButton: Locator;
  readonly emailTestResult: Locator;

  readonly emailAttachmentButton: Locator;
  readonly emailAttachmentResult: Locator;

  readonly testDbContextButton: Locator;
  readonly testDbContextResult: Locator;

  readonly biometricStateButton: Locator;
  readonly biometricStateResult: Locator;

  readonly servicesHealthButton: Locator;
  readonly servicesHealthTable: Locator;

  constructor(private readonly page: Page) {
    this.emailTestButton = page.locator('input[value="Email test"]');
    this.emailTestResult = page.locator('#ctl00_ContentPlaceHolder1_Label1');

    this.emailAttachmentButton = page.locator('input[value="Email attachment test"]');
    this.emailAttachmentResult = page.locator('#ctl00_ContentPlaceHolder1_Label6');

    this.testDbContextButton = page.locator('input[value="Test db context"]');
    this.testDbContextResult = page.locator('#ctl00_ContentPlaceHolder1_Label2');

    this.biometricStateButton = page.locator('#ctl00_ContentPlaceHolder1_btnGetBiometricState');
    this.biometricStateResult = page.locator('#ctl00_ContentPlaceHolder1_lbBiometricStateResult');

    this.servicesHealthButton = page.locator('#ctl00_ContentPlaceHolder1_btnCheckServicesHealth');
    this.servicesHealthTable = page.locator('table.table_border').filter({
      has: page.locator('th').filter({ hasText: /^Service$/ }),
    });
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');

    // Session may have expired — server silently redirects to login page
    if (this.page.url().includes('index.aspx')) {
      const username = process.env.VCT_USERNAME ?? process.env.TEST_USERNAME ?? '';
      const password = process.env.VCT_PASSWORD ?? process.env.TEST_PASSWORD ?? '';
      await new VctLoginPage(this.page).login(username, password);
      await this.page.goto(this.url);
      await this.page.waitForLoadState('networkidle');
    }
  }

  async clickAndWait(button: Locator): Promise<void> {
    const cookieConsent = this.page.locator('#vctCookieConsentAccept');
    if (await cookieConsent.isVisible()) {
      await cookieConsent.click();
    }
    await button.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getDbContextLines(): Promise<string[]> {
    const html = await this.testDbContextResult.innerHTML();
    return html
      .split(/<br\s*\/?>/i)
      .map((line) => line.replace(/<[^>]+>/g, '').trim())
      .filter((line) => line.length > 0);
  }
}
