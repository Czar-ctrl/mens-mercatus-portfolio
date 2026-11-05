#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.env.PDF_OUT || '/workspace/portfolio-preview.pdf';
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + '/', { waitUntil: 'networkidle' });
// Expand all cards for print completeness
await page.evaluate(() => {
  document.querySelectorAll('[data-project-card]').forEach((el) => { el.hidden = false; });
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
});
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
});
console.log('wrote', out);
await browser.close();
