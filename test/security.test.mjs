// Stored XSS through the JSON importer, and the native export path.
import { withBrowser, openApp, createReporter, isoDay } from "./harness.mjs";

const PAYLOAD = '<img src=x onerror="window.__xss()">';

export default async function run() {
  const { check, report } = createReporter("security");
  await withBrowser(async (browser) => {
    const page = await openApp(browser);
    let fired = false;
    await page.exposeFunction("__xss", () => { fired = true; });

    // The importer writes any ft_-prefixed key verbatim, so this is the shape
    // a malicious export can put into storage.
    await page.evaluate(({ today, payload }) => {
      localStorage.clear();
      localStorage.setItem("ft_day_" + today, JSON.stringify({
        meals: { breakfast: [{ name: "Oats", kcal: 100, p: 1, c: 1, f: 1, qty: payload }], lunch: [], dinner: [], snacks: [] },
        exercises: [{ name: "Run", kcal: 100, min: payload }],
        water: payload, weight: 70,
      }));
      state.date = today; state.day = loadDay(today); setView("Today");
    }, { today: isoDay(0), payload: PAYLOAD });
    await page.waitForTimeout(800);

    check("nothing injected into the meals list",
      await page.evaluate(() => document.querySelectorAll(".meal-items img").length), 0);
    check("nothing injected into the exercise list",
      await page.evaluate(() => document.querySelectorAll(".exercises img").length), 0);
    check("the payload did not execute", fired, false);
    check("qty is coerced to a number",
      await page.evaluate(() => typeof state.day.meals.breakfast[0].qty), "number");
    check("exercise minutes are coerced",
      await page.evaluate(() => typeof state.day.exercises[0].min), "number");
    check("water is coerced",
      await page.evaluate(() => typeof state.day.water), "number");

    check("malformed entries are dropped rather than trusted",
      await page.evaluate((d) => {
        localStorage.setItem("ft_day_" + d, JSON.stringify({
          meals: { breakfast: ["nope", null, 42, { name: "ok", kcal: 5 }], lunch: [], dinner: [], snacks: [] },
          exercises: [null, "x"], water: "abc", weight: "heavy",
        }));
        const day = loadDay(d);
        return { items: day.meals.breakfast.length, ex: day.exercises.length, water: day.water, weight: day.weight };
      }, isoDay(-1)), { items: 1, ex: 0, water: 0, weight: null });
    await page.close();

    // Export inside the shell must not put health data on the pasteboard.
    const native = await openApp(browser, { initScript: `
      window.__clipboardUsed = false; window.__shared = null; window.__wrote = null;
      window.Capacitor = { getPlatform: () => 'ios', Plugins: {
        Filesystem: { writeFile: async (o) => { window.__wrote = o; return { uri: 'file:///cache/' + o.path }; } },
        Share: { share: async (o) => { window.__shared = o; } },
      }};
      Object.defineProperty(navigator, 'clipboard', {
        get() { window.__clipboardUsed = true; return { writeText: async () => {} }; }
      });` });
    await native.getByRole("tab", { name: "Settings" }).click();
    await native.waitForTimeout(300);
    await native.click("#exportBtn");
    await native.waitForTimeout(700);
    const ex = await native.evaluate(() => ({
      clip: window.__clipboardUsed, dir: window.__wrote?.directory,
      name: window.__wrote?.path, shared: window.__shared?.url,
    }));
    check("export never touches the clipboard", ex.clip, false);
    check("export writes to the cache directory", ex.dir, "CACHE");
    check("export names the file by date", /^fittrack-\d{4}-\d{2}-\d{2}\.json$/.test(ex.name || ""), true);
    check("export hands the file to the share sheet", (ex.shared || "").startsWith("file:///cache/"), true);
    check("no console errors", [...native.errors], []);
    await native.close();
  });
  return report();
}
