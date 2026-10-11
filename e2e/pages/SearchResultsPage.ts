import { Locator, Page, Response } from '@playwright/test';

export class SearchResultsPage {
  readonly searchButton: Locator;
  readonly resultsTable: Locator;
  readonly recordRows: Locator;

  constructor(
    private readonly page: Page,
    readonly url: string,
    searchButtonId: string,
    tableId: string,
    columnCount: number,
  ) {
    this.searchButton = page.locator(`#${searchButtonId}`);
    this.resultsTable = page.locator(`#${tableId}`);
    this.recordRows = this.resultsTable.locator(`tr:has(> td:nth-child(${columnCount}))`);
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async search(): Promise<Response> {
    const buttonName = await this.searchButton.getAttribute('name');
    if (!buttonName) {
      throw new Error(`Search button on ${this.url} has no postback name.`);
    }
    const [response] = await Promise.all([
      this.page.waitForResponse(response => {
        const formData = new URLSearchParams(response.request().postData() ?? '');
        return new URL(response.url()).pathname.toLowerCase() === this.url &&
          response.request().method() === 'POST' &&
          (formData.has(buttonName) ||
            formData.has(`${buttonName}.x`) ||
            formData.get('__EVENTTARGET') === buttonName);
      }),
      this.searchButton.click(),
    ]);
    return response;
  }
}
