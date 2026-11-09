#!/usr/bin/env node
// Thin wrapper: axe runs inside Playwright suite; this reprints the summary.
import { readFileSync, existsSync } from 'node:fs';
const path = new URL('../proof/after/axe.json', import.meta.url).pathname;
if (!existsSync(path)) {
  console.error('proof/after/axe.json missing — run npm run test:e2e first');
  process.exit(1);
}
const data = JSON.parse(readFileSync(path, 'utf8'));
const counts = {};
for (const v of data.violations) counts[v.impact || 'unknown'] = (counts[v.impact || 'unknown'] || 0) + 1;
console.log(JSON.stringify({ violations: data.violations.length, byImpact: counts, passes: data.passes?.length ?? 0 }, null, 2));
