import { Page } from '@playwright/test';

export class VctLoginPage {
  constructor(private readonly page: Page) {}

  async login(username: string, password: string): Promise<void> {
    // Go directly to login page to always get a fresh session
    await this.page.goto('/control/admin/index.aspx');
    await this.page.waitForLoadState('networkidle');

    // Fill VCT Staff Login form
    const usernameInput = this.page.locator('input[type="text"]').first();
    await usernameInput.waitFor({ state: 'visible' });
    await usernameInput.fill(username);

    const passwordInput = this.page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible' });
    await passwordInput.fill(password);
    await passwordInput.press('Tab'); // ensure value is committed

    await this.page.locator('input[value="Login"], input[type="submit"]').first().click();
    await this.page.waitForLoadState('networkidle');

    const skipMfaButton = this.page.locator('input[value="Skip MFA"]');
    if (await skipMfaButton.isVisible()) {
      await skipMfaButton.click();
    }

    await this.page.waitForURL(
      url => !/\/(?:index|mfa)\.aspx(?:$|\?)/i.test(url.pathname + url.search),
      { timeout: 30000 }
    );
    await this.page.waitForLoadState('networkidle');
  }
}
