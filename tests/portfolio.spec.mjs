import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotDir = 'proof/after/screenshots';
mkdirSync(shotDir, { recursive: true });

test.describe('portfolio preview', () => {
  test('desktop smoke + screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Katlego Mokoto' })).toBeVisible();
    await expect(page.getByRole('link', { name: /See the systems/i })).toBeVisible();
    await expect(page.locator('.proof .num', { hasText: '406' })).toBeVisible();
    await expect(page.locator('.proof .num', { hasText: '20' })).toBeVisible();
    await expect(page.locator('.proof .num', { hasText: '24' })).toBeVisible();
    await page.screenshot({ path: join(shotDir, 'desktop-full.png'), fullPage: true });
    await page.locator('#work').screenshot({ path: join(shotDir, 'desktop-work.png') });
  });

  test('mobile smoke + screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Katlego Mokoto' })).toBeVisible();
    await page.screenshot({ path: join(shotDir, 'mobile-full.png'), fullPage: true });
  });

  test('filters keyboard + semantics', async ({ page }) => {
    await page.goto('/');
    const all = page.getByRole('button', { name: 'All' });
    const studio = page.getByRole('button', { name: 'Studio' });
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await studio.focus();
    await studio.press('Enter');
    await expect(studio).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-project-card]:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#soundx')).toBeVisible();
    await all.click();
    await expect(page.locator('[data-project-card]:not([hidden])')).toHaveCount(6);
  });

  test('reduced motion does not hide content', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-project-card]').first()).toBeVisible();
    const opacity = await page.locator('.reveal').first().evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
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
