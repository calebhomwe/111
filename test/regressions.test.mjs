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

    // Keytel's male and female equations differ substantially; using the male
    // one for everyone overstated a woman's burn by roughly 40%.
    const keytel = await page.evaluate(() => {
      const round = (n) => Math.round(n * 1000) / 1000;
      state.prefs.sex = "male"; state.prefs.age = 30;
      const male = round(heartRateKcalPerMin(150, 70));
      state.prefs.sex = "female";
      const female = round(heartRateKcalPerMin(150, 70));
      state.prefs.sex = null; state.prefs.age = null;
      const unknown = round(heartRateKcalPerMin(150, 70));
      return { male, female, unknown, floorsAtZero: heartRateKcalPerMin(0, 70) };
    });
    check("male equation matches Keytel", keytel.male, 14.222);
    check("female equation matches Keytel", keytel.female, 9.574);
    check("unknown sex falls back to the male equation", keytel.unknown, keytel.male);
    check("a nonsense heart rate cannot go negative", keytel.floorsAtZero, 0);

    // Age must come from the calculator rather than a hardcoded 30.
    check("stored age changes the estimate",
      await page.evaluate(() => {
        state.prefs.sex = "male"; state.prefs.age = 30;
        const at30 = heartRateKcalPerMin(150, 70);
        state.prefs.age = 55;
        const at55 = heartRateKcalPerMin(150, 70);
        state.prefs.sex = null; state.prefs.age = null;
        return at55 > at30;
      }), true);

    check("the calculator persists sex and age",
      await page.evaluate(() => {
        state.prefs.sex = null; state.prefs.age = null;
        $("#mSex").value = "female"; $("#mAge").value = "41";
        $("#calcApply").click();
        const stored = JSON.parse(localStorage.getItem("ft_prefs"));
        return { sex: stored.sex, age: stored.age };
      }), { sex: "female", age: 41 });

    // Quick-add's undo found its item by object identity, which a date hop
    // breaks because the day is re-read from storage: Undo did nothing.
    check("quick-add undo survives a date hop",
      await page.evaluate((today) => {
        localStorage.clear();
        localStorage.setItem("ft_recent", JSON.stringify([{ name: "Apple, 1 medium", kcal: 95, p: 0.5, c: 25, f: 0.3, n: 3, at: 1 }]));
        state.date = today; state.day = emptyDay(); persist();
        setView("Today");
        quickAdd(0);
        const meal = MEALS.map(m => m.id).find(id => state.day.meals[id].length === 1);
        goToDate(shiftISO(today, -1)); goToDate(today);
        state.lastUndo();
        return loadDay(today).meals[meal].length;
      }, isoDay(0)), 0);

    // The JSON importer writes any ft_ key verbatim. Goals and the quick-add
    // list were the two records not coerced on the way back in.
    await page.evaluate((today) => {
      localStorage.clear();
      localStorage.setItem("ft_goals", JSON.stringify({ cal: "2000", p: "abc", c: null, f: -5 }));
      localStorage.setItem("ft_recent", JSON.stringify([{}, null, { name: "Egg, 1 large", kcal: 72, p: 6.3, c: 0.4, f: 5, n: 2, at: 1 }]));
      localStorage.setItem("ft_day_" + today, JSON.stringify({ meals: {}, water: 200000, exercises: [], weight: null }));
    }, isoDay(0));
    await page.reload();
    await page.waitForTimeout(300);
    check("a string calorie goal does not concatenate into 20,000 left", await page.textContent("#calRemaining"), "2,000");
    check("garbage macro goals fall back", [await page.textContent("#pGoal"), await page.textContent("#cGoal")], ["120", "250"]);
    check("a negative goal is clamped, not displayed", await page.textContent("#fGoal"), "0");
    check("a quick-add list with junk entries still renders the good one",
      await page.evaluate(() => [...document.querySelectorAll("#quickChips .chip")].map(b => b.title.includes("Egg"))), [true]);
    check("stored water is capped at the UI's own ceiling",
      await page.evaluate(() => document.querySelectorAll("#glasses .glass").length), 40);
    check("a non-array quick-add list is ignored",
      await page.evaluate(() => { localStorage.setItem("ft_recent", "{}"); render(); return $("#quickCard").hidden; }), true);

    // min="0" does not stop a typed minus sign. The exercise handler skipped
    // the clamp the loader applies, so the HUD showed "-200" until a reload
    // flipped it to 0; a negative custom-food macro was stored and shown as is.
    await page.evaluate(() => { localStorage.clear(); state.day = emptyDay(); persist(); render(); });
    await page.click("#addExerciseBtn");
    await page.fill("#exKcal", "-200");
    await page.click("#exAdd");
    check("a negative burn is clamped before it reaches the HUD",
      [await page.textContent("#calBurned"), await page.textContent("#calRemaining")], ["0", "2,000"]);
    check("a negative custom-food macro is stored as zero",
      await page.evaluate(() => {
        state.pendingMeal = "lunch";
        $("#customKcal").value = "100"; $("#customP").value = "-50";
        $("#customAdd").click();
        return [$("#pVal").textContent, loadDay(state.date).meals.lunch[0].p];
      }), ["0", 0]);
    check("an imported negative macro is coerced like a negative exercise",
      await page.evaluate(() => normalizeItem({ name: "x", kcal: -100, p: -50, c: -1, f: -2, qty: 1 })),
      { name: "x", kcal: 0, p: 0, c: 0, f: 0, qty: 1 });

    check("no console errors", [...page.errors], []);
    await page.close();

    // Chrome with site data blocked throws on every localStorage access, not
    // only on writes. The raw calls outside readJSON/writeJSON threw mid-handler
    // and left the HUD showing the value from before the click.
    const blocked = await openApp(browser, {
      initScript: () => Object.defineProperty(window, "localStorage", {
        get() { throw new DOMException("Access is denied for this document.", "SecurityError"); },
      }),
    });
    await blocked.click("#waterPlus");
    await blocked.click("#waterMinus");
    check("blocked storage: the HUD still follows the water buttons", await blocked.textContent("#waterVal"), "0");
    await blocked.click('nav.tabbar button[data-view="Settings"]');
    check("blocked storage: Settings still renders", await blocked.textContent("#dataSummary"), "No days logged yet.");
    blocked.once("dialog", (d) => d.accept());
    await blocked.click("#wipeBtn");
    await blocked.waitForTimeout(50);
    check("blocked storage: no uncaught errors", [...blocked.errors], []);
    await blocked.close();
  });
  return report();
}
