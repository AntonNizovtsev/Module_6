import { Page, expect } from '@playwright/test';

export class AdminProtocolPage {
  readonly protocolName;
  readonly protocolNumber;
  readonly sponsor;

  constructor(private readonly page: Page) {
    this.protocolName = page.locator('#ctl00_ContentPlaceHolder1_pnlProtocol_txtProtocolName');
    this.protocolNumber = page.locator('#ctl00_ContentPlaceHolder1_pnlProtocol_txtProtocolNumber');
    this.sponsor = page.locator('select[id*="pnlProtocol"][id*="Sponsor"]');
  }

  async open(protocol: string, sponsor: string): Promise<void> {
    await this.page.goto('/control/admin/protocollist.aspx');
    await this.page.locator('#ctl00_ContentPlaceHolder1_txtSearch').fill(protocol);
    await this.page.locator('#ctl00_ContentPlaceHolder1_btnSubmit').click();

    const row = this.page.locator('#ctl00_ContentPlaceHolder1_grdProtocols > tbody > tr').filter({
      has: this.page.getByRole('link', { name: protocol, exact: true }),
    }).filter({
      has: this.page.getByRole('cell', { name: sponsor, exact: true }),
    });
    await expect(row, 'Expected one matching protocol for the specified sponsor').toHaveCount(1);
    await row.getByRole('link', { name: protocol, exact: true }).click();

    await expect(this.page).toHaveURL(/\/control\/admin\/lateprotocoladdedit\.aspx\?id=/);
    await expect(this.protocolName).toHaveValue(protocol);
    await expect(this.protocolNumber).toHaveValue(protocol);
    await expect(this.sponsor.locator('option:checked')).toHaveText(sponsor);
  }

  async expectCompoundExceptionPrerequisites(): Promise<void> {
    const prefix = '#ctl00_ContentPlaceHolder1_pnlProtocol_';
    await this.open('AutoTest RA 3', 'Test Sponsor');
    await expect(this.page.locator(`${prefix}ProtocolCompoundPanel_dlCompound`))
      .toHaveText('Test (300 Days washout required, Radioactive isotope, half-life 5 Hours)');
    await expect(this.page.locator(`${prefix}radIsCohort_1`)).toBeChecked();

    await this.open('AutoTest RA 2', 'Test Sponsor');
    const table = this.page.locator(`${prefix}CompoundExclusionRulesPanel_txtCompoundName`)
      .locator('xpath=ancestor::table[1]');
    const exception = table.getByRole('row').filter({
      has: this.page.getByRole('cell', { name: 'Test', exact: true }),
    }).filter({ hasNot: this.page.locator('table') });
    await expect(exception, 'Manually prepare Test / 29 Days / Screening Date / CMP29 on QA')
      .toHaveCount(1);
    await expect(exception.getByRole('cell'))
      .toHaveText(['Test', '29 Days', 'Screening Date', 'CMP29', '']);
    await expect(this.page.locator(`${prefix}txtWashoutNo`)).toHaveValue('1');
    await expect(this.page.locator(`${prefix}ddlWashoutUnitNo`)).toHaveValue('Months');
    await expect(this.page.locator(`${prefix}ddlWashoutFrom`)).toHaveValue('LBDD');
    await expect(this.page.locator(`${prefix}ddlWashoutTo`)).toHaveValue('AD');
    await expect(this.page.locator('#ctl00_ContentPlaceHolder1_cbScreenFailAnotherSite'))
      .not.toBeChecked();
  }

  async expectWashoutPrerequisites(): Promise<void> {
    const prefix = '#ctl00_ContentPlaceHolder1_pnlProtocol_';
    await this.open('AutoTest RA', 'Test Sponsor');
    await expect(this.page.locator(`${prefix}ProtocolCompoundPanel_dlCompound`))
      .toHaveText('TestCompound (1 Days washout required, Radioactive isotope, half-life 10 Hours)');
    await this.open('AutoTest RA 2', 'Test Sponsor');
    await expect(this.page.locator(`${prefix}ProtocolCompoundPanel_dlCompound [id$="lblName"]`))
      .toHaveText([
        'TestCompound 2 (no exclusions, Radioactive isotope, half-life 2 Hours)',
        'TestCompound (12 Months washout required, Radioactive isotope, half-life 1 Hours)',
      ]);
    for (const [name, value] of [
      ['txtWashoutNo', '1'], ['ddlWashoutUnitNo', 'Months'],
      ['ddlWashoutFrom', 'LBDD'], ['ddlWashoutTo', 'AD'],
    ]) await expect(this.page.locator(`${prefix}${name}`)).toHaveValue(value);
    await expect(this.page.locator(`${prefix}radIsCohort_1`)).toBeChecked();
  }
}
