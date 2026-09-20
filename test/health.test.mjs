// Device pairing capability detection, file import, and the native health bridge.
import { resolve } from "node:path";
import { withBrowser, openApp, createReporter, isoDay, FIXTURES } from "./harness.mjs";

// Stands in for Capacitor's runtime bridge, shaped like capacitor-health.
const capacitorShim = (platform, opts = {}) => `
window.__opened = null;
window.Capacitor = {
  getPlatform: () => ${JSON.stringify(platform)},
  Plugins: {
    Health: {
      isHealthAvailable: async () => ({ available: ${opts.available !== false} }),
      requestHealthPermissions: async () => ({ permissions: {} }),
      queryRecords: async ({ dataType }) =>
        dataType === 'weight' ? { records: ${JSON.stringify(opts.weights ?? [])} } : { records: [] },
      queryAggregated: async () => ({ aggregatedData: ${JSON.stringify(opts.energy ?? [])} }),
      openAppleHealthSettings: async () => { window.__opened = 'apple'; },
      openHealthConnectSettings: async () => { window.__opened = 'hc'; },
      showHealthConnectInPlayStore: async () => { window.__opened = 'store'; },
    }
  }
};`;

export default async function run() {
  const { check, report } = createReporter("health");
  await withBrowser(async (browser) => {
    // --- capability detection in a plain browser ---
    let page = await openApp(browser);
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.waitForTimeout(300);
    check("native row hidden in a browser", await page.locator("#nativeHealthRow").isHidden(), true);
    check("bluetooth buttons disabled when the API is absent",
      await page.evaluate(() => $("#connectHr").disabled && $("#connectScale").disabled), true);
    check("import stays available regardless", await page.locator("#importHealthBtn").isEnabled(), true);
    check("the reason is stated, not hidden",
      await page.evaluate(() => $("#deviceNote").textContent.length > 40), true);

    // --- Apple Health XML ---
    await page.setInputFiles("#healthFile", resolve(FIXTURES, "apple-health-export.xml"));
    await page.waitForTimeout(700);
    check("apple health import reports what it did",
      await page.textContent("#toastMsg"), "Imported 3 weights and 1 activity day");
    check("same-day active energy is summed",
      await page.evaluate(() => loadDay("2026-09-15").exercises[0].kcal), 517);
    check("weight lands on its own day",
      await page.evaluate(() => loadDay("2026-09-16").weight), 77.0);

    // --- CSV, including quoted fields ---
    await page.setInputFiles("#healthFile", resolve(FIXTURES, "quoted.csv"));
    await page.waitForTimeout(700);
    check("quoted commas do not shift columns",
      await page.evaluate(() => loadDay("2026-09-12").weight), 78.1);
    check("doubled quotes parse",
      await page.evaluate(() => splitCSVLine('a,"say ""hi""",c')), ["a", 'say "hi"', "c"]);
    check("zero-calorie rows are skipped",
      await page.evaluate(() => loadDay("2026-09-13").exercises.length), 0);

    // --- a file that is neither ---
    await page.setInputFiles("#healthFile", resolve(FIXTURES, "../harness.mjs"));
    await page.waitForTimeout(600);
    check("an unrecognised file fails cleanly",
      await page.textContent("#toastMsg"), "No weight or energy records found in that file.");
    check("no console errors during import", [...page.errors], []);
    await page.close();

    // --- native: iOS with data ---
    page = await openApp(browser, { initScript: capacitorShim("ios", {
      weights: [{ startDate: isoDay(-1) + "T07:00:00.000Z", value: 77.1 }],
      // iOS queryAggregated hands back epoch millis as a Number, not a string.
      energy: [{ startDate: new Date(isoDay(-1) + "T09:00:00").getTime(), value: 430 }],
    })});
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.waitForTimeout(300);
    check("native row appears in the shell", await page.locator("#nativeHealthRow").isVisible(), true);
    check("controls name the actual store", await page.textContent("#syncHealth"), "Sync from Apple Health");
    await page.click("#syncHealth");
    await page.waitForTimeout(800);
    check("sync reports what it wrote", await page.textContent("#toastMsg"), "Synced 1 weight and 1 activity day");
    check("epoch-millis timestamps land on the right day",
      await page.evaluate((d) => loadDay(d).exercises[0].kcal, isoDay(-1)), 430);
    await page.click("#healthSettings");
    await page.waitForTimeout(250);
    check("settings link routes to Apple Health", await page.evaluate(() => window.__opened), "apple");
    await page.close();

    // --- native: Android, permissions silently denied ---
    page = await openApp(browser, { initScript: capacitorShim("android", { weights: [], energy: [] }) });
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.waitForTimeout(300);
    await page.click("#syncHealth");
    await page.waitForTimeout(700);
    check("an empty sync does not claim success",
      await page.textContent("#toastMsg"), "No data returned. Check FitTrack's permissions in Health Connect.");
    await page.close();

    // --- native: Health Connect not installed ---
    page = await openApp(browser, { initScript: capacitorShim("android", { available: false }) });
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.waitForTimeout(300);
    await page.click("#syncHealth");
    await page.waitForTimeout(700);
    check("a missing store routes to the Play Store", await page.evaluate(() => window.__opened), "store");
    await page.close();

    // --- native: the plugin throws ---
    page = await openApp(browser, { initScript:
      `window.Capacitor = { getPlatform: () => 'ios', Plugins: { Health: {
         isHealthAvailable: async () => { throw new Error('bridge exploded'); } } } };` });
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.waitForTimeout(300);
    await page.click("#syncHealth");
    await page.waitForTimeout(700);
    check("a throwing plugin surfaces the error", await page.textContent("#toastMsg"), "Sync failed: bridge exploded");
    check("and leaves the button usable", await page.locator("#syncHealth").isEnabled(), true);
    check("no console errors in the shell", [...page.errors], []);
    await page.close();
  });
  return report();
}
