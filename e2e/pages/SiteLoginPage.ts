import { Page, expect } from '@playwright/test';

export class SiteLoginPage {
  constructor(private readonly page: Page) {}

  async login(username: string, password: string, site: string): Promise<void> {
    await this.page.goto('/site/index.aspx');
    await this.page.locator('#ctl00_ContentPlaceHolder1_txtUserName').fill(username);
    await this.page.locator('#ctl00_ContentPlaceHolder1_txtPassword').fill(password);
    await this.page.locator('#ctl00_ContentPlaceHolder1_btnSubmit').click();

    await expect(this.page).toHaveURL(/\/site\/(selectsitetenant|sitedashboard)\.aspx/);
    if (new URL(this.page.url()).pathname.endsWith('/selectsitetenant.aspx')) {
      await this.page.locator('#ctl00_ContentPlaceHolder1_ddlSiteTenant').selectOption({ label: site });
      await this.page.locator('#ctl00_ContentPlaceHolder1_btnSubmit').click();
    }

    await expect(this.page).toHaveURL(/\/site\/sitedashboard\.aspx/);
    await expect(this.page.locator('#ctl00_headersite1_ddlSiteTenant option:checked')).toHaveText(site);
  }
}
