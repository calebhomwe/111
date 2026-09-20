// Keyboard reachability, hit areas, and install metadata.
import { withBrowser, openApp, createReporter, isoDay } from "./harness.mjs";

// tabindex="-1" takes an element out of the tab order regardless of its type,
// so it has to be excluded explicitly rather than relying on the tag alone.
const NOT_SKIPPED = ':not([tabindex="-1"]):not([aria-hidden="true"])';
const TAB_SELECTOR = [
  `a[href]${NOT_SKIPPED}`,
  `button:not([disabled])${NOT_SKIPPED}`,
  `input:not([disabled])${NOT_SKIPPED}`,
  `select:not([disabled])${NOT_SKIPPED}`,
  `textarea${NOT_SKIPPED}`,
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export default async function run() {
  const { check, report } = createReporter("accessibility");
  await withBrowser(async (browser) => {
    const page = await openApp(browser, { viewport: { width: 390, height: 844 } });

    await page.evaluate((today) => {
      localStorage.clear();
      localStorage.setItem("ft_day_" + today, JSON.stringify({
        meals: { breakfast: [{ name: "Oatmeal, 1 cup cooked", kcal: 158, p: 6, c: 27, f: 3, qty: 1 }], lunch: [], dinner: [], snacks: [] },
        water: 3, exercises: [{ name: "Run", min: 30, kcal: 300 }], weight: 78,
      }));
    }, isoDay(0));
    await page.reload();
    await page.waitForTimeout(400);

    // WCAG 2.5.8 asks for 24x24. Hidden inputs opened by a button are excluded
    // by being out of the tab order, which the next check enforces.
    const undersized = async () => page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("button, [role=tab], select, a[href]")) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) out.push(`${el.id || el.className}=${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
      }
      return out;
    });

    for (const view of ["Today", "Trends", "Settings"]) {
      await page.getByRole("tab", { name: view }).click();
      await page.waitForTimeout(250);
      check(`hit areas are at least 24px on ${view}`, await undersized(), []);
    }

    await page.getByRole("tab", { name: "Today" }).click();
    await page.waitForTimeout(200);
    await page.locator(".meal", { hasText: "Breakfast" }).getByRole("button", { name: "+ Add food" }).click();
    await page.waitForTimeout(350);
    check("hit areas are at least 24px in the add-food sheet", await undersized(), []);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Nothing invisible may sit in the keyboard path.
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.waitForTimeout(250);
    check("no invisible controls in the tab order",
      await page.evaluate((sel) => {
        const out = [];
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (el.offsetParent !== null && (r.width < 4 || r.height < 4 || cs.opacity === "0")) out.push(el.id || el.tagName);
        }
        return out;
      }, TAB_SELECTOR), []);

    check("every control has an accessible name",
      await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll("button, [role=tab], input, select")) {
          // Inputs driven by a visible button are hidden from AT on purpose.
          if (el.offsetParent === null || el.getAttribute("aria-hidden") === "true") continue;
          const name = (el.getAttribute("aria-label") || el.textContent || "").trim()
            || (el.labels && el.labels[0]?.textContent.trim()) || "";
          if (!name) out.push(el.id || el.className.toString().slice(0, 30));
        }
        return out;
      }), []);

    // Real Tab traversal, so :focus-visible actually applies — a programmatic
    // .focus() deliberately does not trigger it.
    await page.getByRole("tab", { name: "Today" }).click();
    await page.waitForTimeout(250);
    await page.evaluate(() => document.body.focus());
    const stops = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          id: el.id || el.className.toString().slice(0, 24) || el.tagName,
          visible: r.width >= 4 && r.height >= 4 && cs.opacity !== "0",
          ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
        };
      });
      if (info) stops.push(info);
    }
    check("tab traversal reaches controls", stops.length > 10, true);
    check("no invisible tab stops while traversing", stops.filter(s => !s.visible).map(s => s.id), []);
    check("every focused control shows a ring", stops.filter(s => s.visible && !s.ring).map(s => s.id), []);

    check("reduced motion is honoured",
      await page.evaluate(() => [...document.styleSheets[0].cssRules].some(r => r.cssText.includes("prefers-reduced-motion"))), true);

    // Installable, and the manifest must actually parse.
    const pwa = await page.evaluate(() => {
      const link = document.querySelector("link[rel=manifest]");
      if (!link) return { ok: false };
      const json = decodeURIComponent(link.href.replace(/^data:application\/manifest\+json,/, ""));
      const m = JSON.parse(json);
      return {
        ok: true, name: m.name, display: m.display, icons: m.icons.length,
        appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
        appleIcon: !!document.querySelector("link[rel=apple-touch-icon]"),
      };
    });
    check("manifest is present and parses", pwa.ok, true);
    // A data: URI with unencoded quotes closes the attribute early and spills
    // its tail into the page as visible text. This catches that class of bug.
    check("no data-URI fragment leaked into the rendered page",
      await page.evaluate(() => {
        const body = document.body.innerText;
        return /svg|xmlns|viewBox|\/>/.test(body) ? body.slice(0, 60) : "";
      }), "");
    check("manifest declares a standalone app", { name: pwa.name, display: pwa.display, icons: pwa.icons },
      { name: "FitTrack", display: "standalone", icons: 1 });
    check("iOS add-to-home-screen metadata is present", { cap: pwa.appleCapable, icon: pwa.appleIcon },
      { cap: "yes", icon: true });

    check("no console errors", [...page.errors], []);
    await page.close();
  });
  return report();
}
