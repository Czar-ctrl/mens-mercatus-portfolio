#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const jobnet = readFileSync(join(root, 'apps/jobnet/README.md'), 'utf8');
const checks = [
  [/drafts only/i, 'JobNet README must say public drafts only'],
  [/no auto-apply/i, 'JobNet README must say no auto-apply'],
  [/verified employer address/i, 'JobNet README must mention verified employer address'],
  [/quality checks/i, 'JobNet README must mention quality checks'],
  [/not described as .never sending./i, 'JobNet README must not claim private never-sends'],
];
const fails = [];
for (const [re, msg] of checks) {
  if (!re.test(jobnet)) fails.push(msg);
}
if (/never auto-applies and never auto-sends/i.test(jobnet) && /Private server pipeline/i.test(jobnet) === false) {
  fails.push('JobNet still uses blanket never-sends language');
}
const html = readFileSync(join(root, 'preview/index.html'), 'utf8');
if (/testimonial|client logo|Fortune 500/i.test(html)) fails.push('invented social proof detected');
if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('content-check ok');
