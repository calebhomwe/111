// Core logging flows, the theme contract, and layout invariants.
import { withBrowser, openApp, createReporter, isoDay } from "./harness.mjs";

export default async function run() {
  const { check, report } = createReporter("app");
  await withBrowser(async (browser) => {
    const page = await openApp(browser);

    // --- totals, undo, and the day store ---
    await page.evaluate((today) => {
      localStorage.clear();
      state.goals = { cal: 2400, p: 175, c: 265, f: 70, water: 8 };
      state.date = today; state.day = emptyDay();
      state.day.meals.lunch.push({ name: "Chicken breast", kcal: 165, p: 31, c: 0, f: 3.6, qty: 2 });
      persist(); render();
    }, isoDay(0));

    check("food total accounts for servings",
      await page.evaluate(() => $("#calEaten").textContent), "330");
    check("remaining subtracts food from goal",
      await page.evaluate(() => $("#calRemaining").textContent), "2,070");

    await page.evaluate(() => { state.day.exercises.push({ name: "Run", min: 30, kcal: 300 }); persist(); render(); });
    check("exercise is added back to the budget",
      await page.evaluate(() => $("#calRemaining").textContent), "2,370");

    // Exercise is added back, so going over means beating goal + burned.
    const over = await page.evaluate(() => {
      state.goals.cal = 20;          // budget 20 + 300 burned = 320 against 330 eaten
      render();
      return { label: $("#calRemainingLabel").textContent, amount: $("#calRemaining").textContent };
    });
    check("over goal switches the label", over.label, "kcal over");
    check("over goal shows the overage, not a negative", over.amount, "10");

    // --- search ---
    check("token search matches across words",
      await page.evaluate(() => searchFoods("chick breast")[0][0]), "Chicken breast, 100 g cooked");
    check("search returns nothing for gibberish",
      await page.evaluate(() => searchFoods("zzzzqqq").length), 0);

    // --- theme contract: every theme must define every token ---
    const themes = await page.evaluate(() => {
      const names = ["--bg","--bg-2","--card","--card-2","--border","--border-soft","--text","--muted",
                     "--accent","--accent-2","--accent-ink","--danger","--tone-1","--tone-2","--tone-3","--shadow"];
      return THEMES.map((t) => {
        setTheme(t.id);
        const cs = getComputedStyle(document.documentElement);
        return {
          id: t.id,
          applied: document.documentElement.getAttribute("data-theme"),
          missing: names.filter((n) => !cs.getPropertyValue(n).trim()),
        };
      });
    });
    check("every theme applies and defines all tokens",
      themes.filter((t) => t.applied !== t.id || t.missing.length).map((t) => t.id), []);

    // --- contrast: body AAA, muted AA ---
    const contrast = await page.evaluate(() => {
      const lum = (rgb) => {
        const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number).map((v) => {
          v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };
      return THEMES.map((t) => {
        setTheme(t.id);
        const cs = getComputedStyle(document.body);
        const probe = document.createElement("span");
        probe.style.color = "var(--muted)"; document.body.appendChild(probe);
        const muted = getComputedStyle(probe).color; probe.remove();
        return { id: t.id, text: ratio(cs.color, cs.backgroundColor), muted: ratio(muted, cs.backgroundColor) };
      });
    });
    check("body text clears AAA in every theme",
      contrast.filter((c) => c.text < 7).map((c) => c.id), []);
    check("muted text clears AA in every theme",
      contrast.filter((c) => c.muted < 4.5).map((c) => c.id), []);

    // --- preference migration from the two-theme era ---
    check("stored 'dark' migrates to Midnight",
      await page.evaluate(() => normalizeTheme("dark")), "midnight");
    check("stored 'light' migrates to Porcelain",
      await page.evaluate(() => normalizeTheme("light")), "porcelain");
    check("an unknown theme falls back to the default",
      await page.evaluate(() => normalizeTheme("chartreuse")), "obsidian");

    await page.close();

    // --- no horizontal scroll at phone width, on any tab ---
    const phone = await openApp(browser, { viewport: { width: 390, height: 844 } });
    await phone.evaluate(() => {
      localStorage.setItem("ft_recent", JSON.stringify(
        Array.from({ length: 10 }, (_, i) => ({ name: `Food number ${i}`, kcal: 200, p: 1, c: 1, f: 1, n: 10 - i, at: Date.now() }))));
    });
    await phone.reload();
    await phone.waitForTimeout(300);
    const overflow = [];
    for (const view of ["Today", "Trends", "Settings"]) {
      await phone.getByRole("tab", { name: view }).click();
      await phone.waitForTimeout(250);
      const w = await phone.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      if (w.s > w.c + 1) overflow.push(`${view} ${w.s}>${w.c}`);
    }
    check("no horizontal scroll at 390px", overflow, []);
    check("tab bar stays tappable above the content",
      await phone.evaluate(() => {
        const b = document.querySelector("nav.tabbar button");
        const r = b.getBoundingClientRect();
        return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("nav.tabbar");
      }), true);

    check("no console errors", [...phone.errors], []);
    await phone.close();
  });
  return report();
}
