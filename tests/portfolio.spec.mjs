import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotDir = 'proof/after/screenshots';
mkdirSync(shotDir, { recursive: true });

const CARD_HEADINGS = [
  'JobNet Application',
  'Mercatus Assist',
  'THINK',
  'Forex Mercatus Codex',
  'SoundX AI',
  'Mercatus Concierge',
];

const FILTERS = [
  { name: 'All', expected: CARD_HEADINGS },
  { name: 'Career pipeline', expected: ['JobNet Application'] },
  { name: 'Assistants', expected: ['Mercatus Assist', 'THINK'] },
  { name: 'Research', expected: ['Forex Mercatus Codex'] },
  { name: 'Studio', expected: ['SoundX AI'] },
  { name: 'Guides', expected: ['Mercatus Concierge'] },
];

async function settleAndShot(page, path, fullPage = false) {
  // Nudge scroll so any additive motion can run, then settle at top for stable shots
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(120);
    window.scrollTo(0, 0);
    await sleep(200);
  });
  await page.waitForTimeout(250);
  if (fullPage) {
    await page.screenshot({ path, fullPage: true });
  } else {
    await page.locator('#work').screenshot({ path });
  }
}

test.describe('portfolio preview', () => {
  test('desktop smoke + screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Katlego Mokoto' })).toBeVisible();
    await expect(page.getByRole('link', { name: /See the systems/i })).toBeVisible();
    await expect(page.locator('.proof .num', { hasText: '406' })).toBeVisible();
    await expect(page.locator('.proof .num', { hasText: '20' })).toBeVisible();
    await expect(page.locator('.proof .num', { hasText: '24' })).toBeVisible();

    for (const name of CARD_HEADINGS) {
      await expect(page.getByRole('heading', { name }), { message: `card "${name}" visible after load` }).toBeVisible();
    }

    await settleAndShot(page, join(shotDir, 'desktop-full.png'), true);
    await settleAndShot(page, join(shotDir, 'desktop-work.png'), false);
  });

  test('mobile smoke + screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Katlego Mokoto' })).toBeVisible();
    for (const name of CARD_HEADINGS) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
    await settleAndShot(page, join(shotDir, 'mobile-full.png'), true);
  });

  test('filters keyboard + all card headings after each filter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const all = page.getByRole('button', { name: 'All' });
    await expect(all).toHaveAttribute('aria-pressed', 'true');

    for (const name of CARD_HEADINGS) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }

    for (const filter of FILTERS) {
      const btn = page.getByRole('button', { name: filter.name, exact: true });
      await btn.focus();
      await btn.press('Enter');
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-project-card]:not([hidden])')).toHaveCount(filter.expected.length);
      for (const heading of filter.expected) {
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      }
      // Non-matching cards must be hidden
      for (const heading of CARD_HEADINGS.filter((h) => !filter.expected.includes(h))) {
        await expect(page.getByRole('heading', { name: heading })).toBeHidden();
      }
    }

    // Return to All and re-assert all six
    await all.click();
    await expect(page.locator('[data-project-card]:not([hidden])')).toHaveCount(6);
    for (const name of CARD_HEADINGS) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
  });

  test('reduced motion does not hide content', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-project-card]').first()).toBeVisible();
    for (const name of CARD_HEADINGS) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
    const opacity = await page.locator('.reveal').first().evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
    const hasMotionClass = await page.evaluate(() => document.documentElement.classList.contains('js-motion'));
    expect(hasMotionClass).toBe(false);
  });

  test('axe WCAG AA critical/serious', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const { writeFileSync } = await import('node:fs');
    writeFileSync('proof/after/axe.json', JSON.stringify(results, null, 2));
    const bad = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  test('JobNet wording nuance present', async ({ page }) => {
    await page.goto('/');
    const job = page.locator('#jobnet');
    await expect(job.getByText(/drafts only/i)).toBeVisible();
    await expect(job.getByText(/verified employer address/i)).toBeVisible();
    await expect(job.getByText(/quality checks/i)).toBeVisible();
  });
});
