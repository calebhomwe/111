// One case per defect found in review. Each failed before its fix.
import { withBrowser, openApp, createReporter, isoDay } from "./harness.mjs";

export default async function run() {
  const { check, report } = createReporter("regressions");
  await withBrowser(async (browser) => {
    const page = await openApp(browser);

    // capacitor-health returns three different timestamp shapes.
    check("epoch millis (iOS queryAggregated)",
      await page.evaluate(() => healthDateKey(new Date(2026, 8, 15, 9, 0).getTime())), "2026-09-15");
    check("zone-less LocalDateTime (Android)",
      await page.evaluate(() => healthDateKey("2026-09-15T00:00")), "2026-09-15");
    check("a UTC instant maps to the local day, not the UTC one",
      await page.evaluate(() => healthDateKey(new Date(2026, 8, 15, 23, 30).toISOString())), "2026-09-15");
    check("junk is rejected", await page.evaluate(() => healthDateKey("not a date")), null);
    check("null is safe", await page.evaluate(() => healthDateKey(null)), null);

    // Undo stays open while the date can change underneath it.
    const undo = await page.evaluate((today) => {
      localStorage.clear();
      state.date = today; state.day = emptyDay();
      state.day.meals.lunch.push({ name: "Test", kcal: 500, p: 1, c: 1, f: 1, qty: 1 });
      persist();
      removeItem("lunch", 0);
      const other = shiftISO(today, -3);
      state.date = other; state.day = loadDay(other);
      state.lastUndo();
      return { original: loadDay(today).meals.lunch.length, other: loadDay(other).meals.lunch.length };
    }, isoDay(0));
    check("undo restores the day it came from", undo.original, 1);
    check("undo does not leak onto the visible day", undo.other, 0);

    // The lb fallback was being converted as pounds.
    check("a missing weight in lb mode still yields a sane target",
      await page.evaluate(() => {
        state.prefs.unit = "lb";
        $("#mWeight").value = ""; $("#mSex").value = "male"; $("#mAge").value = "30";
        $("#mHeight").value = "175"; $("#mActivity").value = "1.375"; $("#mGoal").value = "0";
        const cal = calcTargets().cal;
        state.prefs.unit = "kg";
        return cal > 2000 && cal < 2800;
      }), true);

    // A measured session must keep its own rate when the minutes are edited.
    const hr = await page.evaluate(() => {
      state.day.weight = 80;
      finishHeartRateSession({ name: "Polar H10", started: Date.now() - 30 * 60000, samples: [150, 150, 150] });
      const first = Number($("#exKcal").value);
      $("#exMin").value = "60";
      $("#exMin").dispatchEvent(new Event("input"));
      const sel = $("#exType");
      return { first, doubled: Number($("#exKcal").value), name: sel.options[sel.selectedIndex].dataset.name };
    });
    check("measured calories scale with minutes", Math.abs(hr.doubled - hr.first * 2) <= 2, true);
    check("the entry keeps the device name", hr.name, "Polar H10");
    check("a fresh dialog drops the stale measured option",
      await page.evaluate(() => {
        $("#addExerciseBtn").click();
        const sel = $("#exType");
        return sel.options[sel.selectedIndex].dataset.name;
      }), "Walking, moderate");

    // Trends must not contradict itself when only today is logged.
    const trends = await page.evaluate((today) => {
      localStorage.clear();
      state.goals = { cal: 2400, p: 175, c: 265, f: 70, water: 8 };
      state.date = today; state.day = emptyDay();
      state.day.meals.lunch.push({ name: "Only today", kcal: 900, p: 60, c: 80, f: 20, qty: 1 });
      persist(); setView("Trends");
      return {
        empty: document.querySelector("#macroChartWrap .empty-state") !== null,
        avg: $("#kAvg").textContent.replace(/\s/g, ""),
      };
    }, isoDay(0));
    check("macro chart is not empty while the calorie chart has a bar", trends.empty, false);
    check("averages fall back to today", trends.avg, "900kcal");

    check("no console errors", [...page.errors], []);
    await page.close();
  });
  return report();
}
