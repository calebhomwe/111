import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const APP = "file://" + resolve(ROOT, "index.html");
export const FIXTURES = resolve(ROOT, "test", "fixtures");

// The sandbox ships a pinned Chromium; fall back to Playwright's own download.
const BUNDLED = "/opt/pw-browsers/chromium";
const launchOpts = existsSync(BUNDLED) ? { executablePath: BUNDLED } : {};

export const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function withBrowser(fn) {
  const browser = await chromium.launch(launchOpts);
  try { return await fn(browser); } finally { await browser.close(); }
}

/** Opens the app and fails the run on any console error or uncaught exception. */
export async function openApp(browser, { initScript, viewport } = {}) {
  const page = await browser.newPage({ viewport: viewport ?? { width: 900, height: 1200 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  if (initScript) await page.addInitScript(initScript);
  await page.goto(APP);
  await page.waitForTimeout(300);
  page.errors = errors;
  return page;
}

export function createReporter(suite) {
  let passed = 0;
  const failures = [];
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { passed++; }
    else { failures.push({ name, got, want }); }
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
    if (!ok) console.log(`       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`);
  };
  const report = () => {
    if (failures.length) {
      console.log(`\n${suite}: ${passed} passed, ${failures.length} FAILED`);
    } else {
      console.log(`\n${suite}: ${passed} passed`);
    }
    return failures.length;
  };
  return { check, report };
}
