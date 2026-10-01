// A hosted frame (the claude.ai artifact viewer) takes three things away from a page:
// it answers confirm() with "no", it blocks downloads the page starts itself, and it
// withholds storage so that touching window.localStorage throws. The first blocks
// simulate each of those and check the app still does its job; the last runs the
// app inside a genuinely sandboxed iframe so the result does not rest on my stubs.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withBrowser, openApp, createReporter, isoDay, APP } from "./harness.mjs";

const EXPORT_NAME = /^fittrack-\d{4}-\d{2}-\d{2}\.json$/;

const SEED = () => {
  localStorage.clear();
  state.day = emptyDay();
  state.day.water = 3;
  state.day.meals.lunch.push({ name: "Test lunch", kcal: 500, p: 30, c: 40, f: 20, qty: 1 });
  persist(); render();
};

// Stand-in for the host: `grant` decides whether the downloads capability exists.
const hostStub = (grant) => `(() => {
  window.__saved = [];
  window.claude = { use: async (name) => ${grant} && name === "downloads"
    ? { save: async (req) => { window.__saved.push(req); return { status: "saved" }; } }
    : null };
})();`;

const openSettings = (page) => page.getByRole("tab", { name: "Settings" }).click();

export default async function run() {
  const { check, report } = createReporter("frame");

  // One block failing must not hide the others, and a missing element should fail
  // in seconds rather than after Playwright's default half-minute.
  const block = async (name, fn) => {
    try { await fn(); }
    catch (e) { check(`${name} ran to the end`, String(e.message).split("\n")[0], "no error"); }
  };
  const app = async (browser, opts) => {
    const page = await openApp(browser, opts);
    page.setDefaultTimeout(5000);
    return page;
  };

  // A dialog's close event is a task of its own, so whatever the answer triggers runs
  // just after the click returns. Positive checks wait for the outcome; a check that
  // something did NOT happen gets a short settle first.
  const settle = (target) => target.evaluate(() => new Promise((done) => setTimeout(done, 80)));
  const until = async (target, what, fn) => {
    try { await target.waitForFunction(fn, undefined, { timeout: 4000 }); return true; }
    catch { check(what, "never happened", "happened"); return false; }
  };

  await withBrowser(async (browser) => {

    /* ── Destructive actions ask in the page, not through confirm() ── */
    await block("in-page confirmation", async () => {
      const raised = [];
      const page = await app(browser, {
        initScript: () => {
          window.__native = [];
          window.confirm = () => { window.__native.push("confirm"); return false; };
          window.alert = () => { window.__native.push("alert"); };
          window.prompt = () => { window.__native.push("prompt"); return null; };
        },
      });
      page.on("dialog", (d) => { raised.push(d.type()); d.dismiss(); });
      await page.evaluate(SEED);
      await openSettings(page);

      const open = () => page.evaluate(() => $("#confirmDialog")?.open ?? false);
      const water = () => page.evaluate(() => state.day.water);

      await page.click("#resetDayBtn");
      check("Clear this day opens an in-page dialog", await open(), true);
      check("the dialog states what will happen",
        await page.evaluate(() => ({
          role: $("#confirmDialog").getAttribute("role"),
          title: $("#confirmTitle").textContent,
          body: $("#confirmBody").textContent,
          action: $("#confirmOk").textContent,
        })),
        { role: "alertdialog", title: "Clear this day?",
          body: "Removes everything you logged today. You'll have a few seconds to undo.",
          action: "Clear this day" });
      check("Cancel holds the initial focus", await page.evaluate(() => document.activeElement?.id), "confirmCancel");
      await page.keyboard.press("Enter");
      await settle(page);
      check("Enter on the default focus cancels", [await open(), await water()], [false, 3]);

      await page.click("#resetDayBtn");
      await page.keyboard.press("Escape");
      await settle(page);
      check("Escape cancels", [await open(), await water()], [false, 3]);

      await page.click("#resetDayBtn");
      await page.mouse.click(4, 4);
      await settle(page);
      check("clicking outside the dialog cancels", [await open(), await water()], [false, 3]);

      await page.click("#resetDayBtn");
      await page.click("#confirmOk");
      await until(page, "the day is cleared", () => state.day.water === 0);
      check("confirming clears the day",
        await page.evaluate(() => ({ water: state.day.water, meals: MEALS.reduce((n, m) => n + state.day.meals[m.id].length, 0) })),
        { water: 0, meals: 0 });
      check("and offers undo",
        await page.evaluate(() => ({ shown: $("#toast").classList.contains("show"), undo: !$("#toastAction").hidden, msg: $("#toastMsg").textContent })),
        { shown: true, undo: true, msg: "Day cleared" });
      await page.click("#toastAction");
      check("undo restores it", await water(), 3);

      await page.click("#wipeBtn");
      check("Delete everything opens the dialog",
        await page.evaluate(() => ({ open: $("#confirmDialog").open, title: $("#confirmTitle").textContent, action: $("#confirmOk").textContent })),
        { open: true, title: "Delete everything?", action: "Delete everything" });
      await page.click("#confirmCancel");
      await settle(page);
      check("cancelling keeps the record", await page.evaluate(() => storedKeys().length > 0), true);
      await page.click("#wipeBtn");
      await page.click("#confirmOk");
      await until(page, "the record is erased", () => storedKeys().length === 0);
      check("confirming erases every FitTrack key", await page.evaluate(() => storedKeys().length), 0);

      check("the page never called confirm, alert or prompt", await page.evaluate(() => window.__native), []);
      check("no native dialog was raised", raised, []);
      check("no storage notice while storage works", await page.evaluate(() => $("#unsavedNote").hidden), true);
      check("no console errors", page.errors, []);
    });

    /* ── Export goes through the host's downloads capability ── */
    await block("host export", async () => {
      const page = await app(browser, {
        initScript: `(() => {
          window.__anchorClicks = 0;
          const click = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function () { window.__anchorClicks++; return click.call(this); };
        })(); ${hostStub(true)}`,
      });
      await page.evaluate(SEED);
      await openSettings(page);
      await page.click("#exportBtn");
      await until(page, "the host is offered the file", () => window.__saved.length === 1);
      const saved = await page.evaluate(() => window.__saved[0]);
      const parsed = JSON.parse(saved?.data ?? "{}");
      check("export is offered through the host capability", EXPORT_NAME.test(saved?.filename ?? ""), true);
      check("the file carries the whole record",
        { app: parsed.app, days: Object.keys(parsed.data ?? {}).filter(k => k.startsWith("ft_day_")).length }, { app: "fittrack", days: 1 });
      check("the page starts no download of its own", await page.evaluate(() => window.__anchorClicks), 0);
      check("export raises nothing", page.errors, []);

      const slow = await app(browser, {
        initScript: `(() => {
          window.__saved = [];
          window.claude = { use: async () => ({ save: async (req) => {
            await new Promise((done) => setTimeout(done, 200));
            window.__saved.push(req);
            return { status: "saved" };
          } }) };
        })();`,
      });
      await openSettings(slow);
      await slow.dblclick("#exportBtn");
      await until(slow, "the slow save completes", () => window.__saved.length >= 1);
      await slow.evaluate(() => new Promise((done) => setTimeout(done, 400)));
      check("a double-click raises one prompt, not two", await slow.evaluate(() => window.__saved.length), 1);

      const declined = await app(browser, {
        initScript: () => {
          window.claude = { use: async () => ({ save: async () => { throw { code: "declined", message: "Declined" }; } }) };
        },
      });
      await openSettings(declined);
      await declined.click("#exportBtn");
      await settle(declined);
      check("declining the save is quiet", await declined.evaluate(() => $("#toast").classList.contains("show")), false);
      check("and raises nothing", declined.errors, []);

      // Top level, so a download works: the capability being absent must not block it.
      const withheld = await app(browser, { initScript: hostStub(false) });
      await openSettings(withheld);
      const [viaWithheld] = await Promise.all([withheld.waitForEvent("download", { timeout: 5000 }), withheld.click("#exportBtn")]);
      check("top level with the capability withheld, the ordinary download runs", EXPORT_NAME.test(viaWithheld.suggestedFilename()), true);

      const plain = await app(browser);
      await openSettings(plain);
      const [viaPlain] = await Promise.all([plain.waitForEvent("download", { timeout: 5000 }), plain.click("#exportBtn")]);
      check("outside any host the ordinary download runs", EXPORT_NAME.test(viaPlain.suggestedFilename()), true);
    });

    /* ── Storage withheld: touching window.localStorage throws ── */
    await block("withheld storage", async () => {
      const page = await app(browser, {
        initScript: `Object.defineProperty(window, "localStorage", {
          configurable: true,
          get() { throw new DOMException("Access is denied for this document.", "SecurityError"); },
        }); ${hostStub(true)}`,
      });
      check("Today renders", await page.evaluate(() => !!document.querySelector(".hero-num")), true);
      await page.getByRole("tab", { name: "Trends" }).click();
      await openSettings(page);
      check("Settings reports an empty history", await page.locator("#dataSummary").textContent(), "No days logged yet.");
      await page.getByRole("tab", { name: "Today" }).click();
      check("every tab opens without an exception", page.errors, []);

      check("no notice before anything is written", await page.evaluate(() => $("#unsavedNote").hidden), true);
      for (let i = 0; i < 3; i++) await page.click("#waterPlus");
      check("logging still works", await page.evaluate(() => state.day.water), 3);
      await page.evaluate(() => goToDate(shiftISO(state.date, -1)));
      check("the previous day is empty", await page.evaluate(() => state.day.water), 0);
      await page.evaluate(() => goToDate(shiftISO(state.date, 1)));
      check("the day survives leaving it and coming back", await page.evaluate(() => state.day.water), 3);
      check("the notice says nothing is being kept",
        await page.evaluate(() => ({ hidden: $("#unsavedNote").hidden, text: $("#unsavedNote").textContent })),
        { hidden: false, text: "Storage is unavailable here, so nothing you log is being saved. It will be lost when you close this tab." });

      await openSettings(page);
      check("and it stays in view on other tabs",
        await page.evaluate(() => { const r = $("#unsavedNote").getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; }), true);
      check("Settings says the history is held for the session",
        await page.locator("#dataSummary").textContent(), "1 day of history held until you close this tab.");
      await page.click("#exportBtn");
      await until(page, "the host is offered the file", () => window.__saved.length === 1);
      const exported = JSON.parse(await page.evaluate(() => window.__saved[0]?.data ?? "{}"));
      check("export includes what only memory holds",
        Object.keys(exported.data ?? {}).filter(k => k.startsWith("ft_day_")).length, 1);

      await page.click("#wipeBtn");
      await page.click("#confirmOk");
      await until(page, "the record is erased", () => storedKeys().length === 0);
      check("Delete everything empties the in-memory record too",
        await page.evaluate(() => ({ keys: storedKeys().length, water: state.day.water })), { keys: 0, water: 0 });

      await page.setInputFiles("#importFile", {
        name: "export.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ app: "fittrack", version: 2, data: {
          [`ft_day_${isoDay(-2)}`]: { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 4, exercises: [], weight: null },
        } })),
      });
      await until(page, "the import lands", () => storedKeys().length === 1);
      check("an import lands in memory and reads back",
        await page.evaluate((d) => loadDay(d).water, isoDay(-2)), 4);
      check("no exceptions throughout", page.errors, []);
    });

    /* ── Storage readable but full: setItem throws ── */
    await block("full storage", async () => {
      const today = isoDay(0);
      const page = await app(browser, {
        initScript: `(() => {
          localStorage.setItem("ft_day_${today}", JSON.stringify(
            { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 1, exercises: [], weight: null }));
          Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError"); };
        })();`,
      });
      check("the stored day loads", await page.evaluate(() => state.day.water), 1);
      await page.click("#waterPlus");
      await page.evaluate(() => goToDate(shiftISO(state.date, -1)));
      await page.evaluate(() => goToDate(shiftISO(state.date, 1)));
      check("a refused write does not resurrect the stale stored value", await page.evaluate(() => state.day.water), 2);
      check("a refused write raises the notice", await page.evaluate(() => $("#unsavedNote").hidden), false);
      check("a full disk raises nothing", page.errors, []);
    });

    /* ── The real thing: an iframe sandboxed the way the host frames a page ── */
    const inSandbox = async (init) => {
      const wrapper = join(mkdtempSync(join(tmpdir(), "fittrack-host-")), "host.html");
      writeFileSync(wrapper, `<!doctype html><iframe src="${APP}" sandbox="allow-scripts" style="width:900px;height:1100px;border:0"></iframe>`);
      const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
      const downloads = [];
      page.on("download", (d) => downloads.push(d.suggestedFilename()));
      await page.addInitScript(init);
      await page.goto("file://" + wrapper);
      const frame = page.frames().find((f) => f !== page.mainFrame());
      await frame.waitForSelector(".hero-num");
      return { page, frame, errors, downloads };
    };

    await block("sandboxed page with the capability", async () => {
      const { frame, errors } = await inSandbox(`if (window.top !== window) { ${hostStub(true)} }`);
      check("the app boots inside the sandbox", await frame.evaluate(() => !!document.querySelector(".hero-num")), true);
      await frame.click("#waterPlus");
      await frame.click("#waterPlus");
      await frame.getByRole("tab", { name: "Settings" }).click();
      check("Settings opens with storage unavailable", await frame.locator("#dataSummary").textContent(), "1 day of history held until you close this tab.");
      await frame.click("#resetDayBtn");
      await frame.click("#confirmOk");
      await until(frame, "the sandboxed day is cleared", () => state.day.water === 0);
      check("Clear this day works where confirm() cannot", await frame.evaluate(() => state.day.water), 0);
      check("the sandboxed page says nothing is being kept", await frame.evaluate(() => $("#unsavedNote").hidden), false);
      await frame.click("#exportBtn");
      await until(frame, "the sandboxed host is offered the file", () => window.__saved.length === 1);
      check("export reaches the host from inside the sandbox", EXPORT_NAME.test(await frame.evaluate(() => window.__saved[0]?.filename ?? "")), true);
      check("no exceptions inside the sandbox", errors, []);

      // Premise checks last: calling confirm() in a sandbox logs a console error of its own.
      check("the sandbox really does block storage",
        await frame.evaluate(() => { try { void window.localStorage; return "readable"; } catch (e) { return e.name; } }), "SecurityError");
      check("the sandbox really does answer confirm() with no", await frame.evaluate(() => confirm("x")), false);
    });

    await block("sandboxed page without the capability", async () => {
      const { frame, downloads, errors } = await inSandbox(`if (window.top !== window) { ${hostStub(false)} }`);
      await frame.getByRole("tab", { name: "Settings" }).click();
      await frame.click("#exportBtn");
      await until(frame, "the sandboxed page explains", () => $("#toast").classList.contains("show"));
      check("a frame without the capability says downloads are unavailable",
        await frame.evaluate(() => $("#toastMsg").textContent), "Downloads aren't available in this view.");
      check("and never claims success or starts a download", downloads, []);
      check("that raises nothing either", errors, []);
    });
  });
  return report();
}
