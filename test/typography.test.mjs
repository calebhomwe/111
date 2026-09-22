// Type pairings: each must actually change the rendered face, not just the attribute.
import { withBrowser, openApp, createReporter, isoDay } from "./harness.mjs";

export default async function run() {
  const { check, report } = createReporter("typography");
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

    const rows = await page.evaluate(async () => {
      const out = [];
      for (const f of FONTS) {
        setFont(f.id);
        await document.fonts.ready;
        const cs = getComputedStyle(document.querySelector(".hero-num"));
        out.push({
          id: f.id,
          applied: document.documentElement.getAttribute("data-font"),
          display: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          weight: cs.fontWeight,
          tracking: cs.letterSpacing,
        });
      }
      return out;
    });

    check("all six pairings are registered", rows.length, 6);
    check("every pairing applies its attribute",
      rows.filter(r => r.applied !== r.id).map(r => r.id), []);
    // The regression this guards: a later :root re-declared the same variables
    // at equal specificity, so all six rendered Instrument Serif.
    check("every pairing resolves a distinct display face",
      new Set(rows.map(r => r.display)).size, rows.length);
    check("display faces are the ones declared",
      rows.map(r => r.display),
      ["Instrument Serif", "Space Grotesk", "Fraunces", "JetBrains Mono", "Inter", "-apple-system"]);
    check("weight and tracking travel with the pairing",
      rows.map(r => `${r.weight}/${r.tracking}`),
      ["400/-1.5px", "500/-2.5px", "500/-1.5px", "500/-3px", "600/-2.5px", "600/-2px"]);

    check("every embedded face actually loads",
      await page.evaluate(async () => {
        await document.fonts.ready;
        return ["Inter", "Instrument Serif", "Space Grotesk", "Fraunces", "JetBrains Mono"]
          .filter(f => !document.fonts.check(`16px "${f}"`));
      }), []);

    check("the choice persists",
      await page.evaluate(() => { setFont("technical"); return JSON.parse(localStorage.getItem("ft_prefs")).font; }), "technical");
    check("an unknown pairing falls back",
      await page.evaluate(() => normalizeFont("comic")), "editorial");
    check("prefs without a font key default cleanly",
      await page.evaluate(() => {
        localStorage.setItem("ft_prefs", JSON.stringify({ theme: "obsidian", unit: "kg" }));
        return loadPrefs().font;
      }), "editorial");

    // Type and colour must stay independent.
    check("changing typeface leaves the theme alone",
      await page.evaluate(() => {
        setTheme("emerald"); setFont("warm");
        return {
          theme: document.documentElement.getAttribute("data-theme"),
          font: document.documentElement.getAttribute("data-font"),
        };
      }), { theme: "emerald", font: "warm" });

    // A wider face must not break the phone layout.
    const overflow = [];
    for (const id of ["modern", "technical", "neutral", "system"]) {
      await page.evaluate((f) => setFont(f), id);
      await page.waitForTimeout(250);
      const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      if (w.s > w.c + 1) overflow.push(`${id} ${w.s}>${w.c}`);
    }
    check("no pairing causes horizontal scroll at 390px", overflow, []);

    check("no console errors", [...page.errors], []);
    await page.close();
  });
  return report();
}
