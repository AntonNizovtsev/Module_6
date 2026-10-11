import { Locator, Page, Response } from '@playwright/test';

export class SubjectsPage {
  readonly url = '/control/admin/subjects.aspx';
  readonly searchButton: Locator;
  readonly resultsTable: Locator;
  readonly subjectRows: Locator;

  constructor(private readonly page: Page) {
    this.searchButton = page.locator('#ctl00_ContentPlaceHolder1_btnSearch');
    this.resultsTable = page.locator('#ctl00_ContentPlaceHolder1_grdSubjects');
    this.subjectRows = this.resultsTable.locator('tr:has(> td:nth-child(10))');
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async search(): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.toLowerCase() === this.url &&
        response.request().method() === 'POST' &&
        (response.request().postData() ?? '').includes('btnSearch')
      ),
      this.searchButton.click(),
    ]);
    return response;
  }
}
