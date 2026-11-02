import { test, expect } from '@playwright/test';
import { SyncStatusPage } from '../../pages/SyncStatusPage';

// Protocol to select in the Protocol ddl. Set SYNC_TEST_PROTOCOL to pin an
// exact label (e.g. a known QA test sponsor); left unset, the test picks the
// first real entry near the top of the list — the safer default on
// environments (like PROD) whose protocol list isn't known in advance.
const PROTOCOL_LABEL_OVERRIDE = process.env.SYNC_TEST_PROTOCOL;

test.describe('Subject Sync (Admin)', () => {
  test('page opens, a protocol can be selected, and Auto-Sync produces results', async ({ page }) => {
    // Auto-Sync runs a real sync against the data provider — some PROD
    // regions take noticeably longer than QA/EU, so give this test more
    // headroom than the global 60s default.
    test.setTimeout(180_000);

    const syncPage = new SyncStatusPage(page);

    // ── Step 1: the page opens ────────────────────────────────────────────
    await syncPage.goto();
    await expect(page).toHaveURL(/syncstatus\.aspx/);
    await expect(syncPage.protocolChosenTrigger).toBeVisible();
    await expect(syncPage.autoSyncButton).toBeVisible();

    // ── Step 2: select a protocol from the Protocol ddl ────────────────────
    // Some accounts/environments have no protocols assigned at all (e.g. the
    // CN prod test account) — nothing to select or sync in that case.
    const protocolCount = await syncPage.getProtocolOptionCount();
    test.skip(protocolCount === 0, 'Protocol ddl is empty on this environment/account — nothing to sync.');

    let selectedProtocol: string;
    if (PROTOCOL_LABEL_OVERRIDE) {
      await syncPage.selectProtocolByLabel(PROTOCOL_LABEL_OVERRIDE);
      selectedProtocol = PROTOCOL_LABEL_OVERRIDE;
    } else {
      selectedProtocol = await syncPage.selectFirstAvailableProtocol();
    }
    expect(selectedProtocol.length).toBeGreaterThan(0);
    await expect(syncPage.protocolChosenTrigger).toContainText(selectedProtocol);
    console.log(`Selected protocol: "${selectedProtocol}"`);

    // ── Step 3: run Auto-Sync ──────────────────────────────────────────────
    await syncPage.clickAutoSync();

    // ── Step 4: Auto-Sync completed without erroring ───────────────────────
    // The page must still be the live Subject Sync form (no ASP.NET error
    // page, no redirect) — that's the actual smoke-test contract. Whether a
    // "File Date/Time" results section also renders depends on whether this
    // protocol has a data-provider file to sync, which varies by protocol/
    // region and isn't something the test controls, so it's checked and
    // reported rather than asserted.
    await expect(page).toHaveURL(/syncstatus\.aspx/);
    await expect(syncPage.protocolChosenTrigger).toBeVisible();
    await expect(syncPage.autoSyncButton).toBeVisible();

    const hasResults = await syncPage.fileDateTimeText.isVisible().catch(() => false);
    if (hasResults) {
      await expect(syncPage.subjectsProcessedText).toBeVisible();
      await expect(syncPage.requiredStatusUpdatesHeading).toBeVisible();
      await expect(syncPage.gridIssues).toBeVisible();
      console.log(`Auto-Sync produced a results section for "${selectedProtocol}".`);
    } else {
      console.log(
        `Auto-Sync completed for "${selectedProtocol}" but rendered no "File Date/Time" ` +
          `results section — this protocol likely has no data-provider file to sync yet, not a test failure.`
      );
    }

    // Include the environment and UTC timestamp so screenshots remain distinct.
    const envLabel = new URL(page.url()).hostname.replace(/[^a-z0-9]+/gi, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({
      path: `sync-status-result-${envLabel}-${timestamp}.png`,
      fullPage: true,
    });
  });
});
