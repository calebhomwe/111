// Runs every suite sequentially and exits non-zero if any assertion fails.
import app from "./app.test.mjs";
import health from "./health.test.mjs";
import regressions from "./regressions.test.mjs";
import security from "./security.test.mjs";
import accessibility from "./accessibility.test.mjs";

const suites = { app, health, regressions, security, accessibility };
const only = process.argv[2];
let failed = 0;

for (const [name, run] of Object.entries(suites)) {
  if (only && only !== name) continue;
  console.log(`\n── ${name} ──`);
  failed += await run();
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nAll suites passed.");
process.exit(failed ? 1 : 0);
