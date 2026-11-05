#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const errors = [];
const mustExist = [
  'preview/index.html',
  'preview/css/preview.css',
  'preview/js/preview.js',
  'preview/media/mm-seal.svg',
  'preview/media/jobnet.webp',
  'preview/media/assist.webp',
  'preview/media/think.webp',
  'preview/media/forex.webp',
  'preview/media/soundx.webp',
  'preview/media/concierge.webp',
];
for (const f of mustExist) {
  if (!existsSync(join(root, f))) errors.push(`missing ${f}`);
}
const html = readFileSync(join(root, 'preview/index.html'), 'utf8');
if (/ARCANUM/i.test(html)) errors.push('ARCANUM found in preview HTML');
if (!/prefers-reduced-motion/.test(readFileSync(join(root, 'preview/css/preview.css'), 'utf8'))) {
  errors.push('reduced-motion rules missing from CSS');
}
if (!/data-filter/.test(html) || !/aria-pressed/.test(html)) errors.push('accessible filters missing');
if (!/>406</.test(html) || !/>20</.test(html) || !/>24</.test(html)) errors.push('verified proof figures missing');
if (!/See the systems/.test(html)) errors.push('stronger hero CTA missing');
if (!/drafts only/i.test(html)) errors.push('JobNet public drafts-only wording missing');
if (!/printed a verified employer address/i.test(html) && !/prints a verified employer address/i.test(html)) {
  errors.push('JobNet private gated-send wording missing');
}
if (errors.length) {
  console.error('lint failed:\n' + errors.map((e) => ` - ${e}`).join('\n'));
  process.exit(1);
}
console.log('lint ok');
