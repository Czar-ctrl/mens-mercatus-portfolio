#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
mkdirSync('proof/after', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const responses = [];
page.on('response', async (res) => {
  try {
    const req = res.request();
    if (req.resourceType() === 'document' || req.resourceType() === 'stylesheet' || req.resourceType() === 'script' || req.resourceType() === 'image' || req.resourceType() === 'font') {
      const buf = await res.body().catch(() => null);
      responses.push({
        url: res.url(),
        type: req.resourceType(),
        status: res.status(),
        bytes: buf ? buf.length : 0,
      });
    }
  } catch {}
});
await page.goto(base + '/', { waitUntil: 'networkidle' });
const total = responses.reduce((a, b) => a + b.bytes, 0);
const byType = {};
for (const r of responses) byType[r.type] = (byType[r.type] || 0) + r.bytes;
const report = {
  url: base + '/',
  transferBytesApprox: total,
  transferKB: Math.round(total / 1024),
  byType,
  resources: responses.sort((a, b) => b.bytes - a.bytes).slice(0, 30),
  note: 'Local static transfer sizes (uncompressed body lengths). Not a full Lighthouse lab run.',
};
writeFileSync('proof/after/page-weight.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ transferKB: report.transferKB, byType }, null, 2));
await browser.close();
