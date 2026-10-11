import { Locator, Page } from '@playwright/test';
import { SearchResultsPage } from './SearchResultsPage';

export class SubjectsPage extends SearchResultsPage {
  readonly subjectRows: Locator;

  constructor(page: Page) {
    super(
      page,
      '/control/admin/subjects.aspx',
      'ctl00_ContentPlaceHolder1_btnSearch',
      'ctl00_ContentPlaceHolder1_grdSubjects',
      10,
    );
    this.subjectRows = this.recordRows;
  }
}
