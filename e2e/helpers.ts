import { expect, type Page } from '@playwright/test';
import type { ArrangeSpec, TestState } from '../src/testing/testApi';

export const ARENA = { width: 1280, height: 720 };

export interface OpenOptions {
  query?: Record<string, string>;
  /** localStorage options to seed before the app boots. */
  options?: { sessionTimeSec: number; enemySpawnTimeSec: number };
}

/** Opens the app in an isolated state (fresh context per test) and collects console errors. */
export async function openApp(page: Page, opts: OpenOptions = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  if (opts.options) {
    await page.addInitScript((o) => {
      if (!localStorage.getItem('pb.options.v1')) localStorage.setItem('pb.options.v1', JSON.stringify(o));
    }, opts.options);
  }
  const params = new URLSearchParams({ e2e: '1', ...(opts.query ?? {}) });
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  return errors;
}

/** Deterministic arena: manual clock, fixed seed, no timed spawns. */
export const ARENA_QUERY = { seed: '1', clock: 'manual', nospawn: '1' };

export async function startMatch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => window.__PB__?.state().status === 'running', undefined, { timeout: 15_000 });
}

export const state = (page: Page): Promise<TestState> => page.evaluate(() => window.__PB__!.state());
export const advance = (page: Page, ms: number): Promise<void> => page.evaluate((m) => window.__PB__!.advance(m), ms);
export const arrange = (page: Page, spec: ArrangeSpec): Promise<void> => page.evaluate((s) => window.__PB__!.arrange(s), spec);

export async function expectNoErrors(errors: string[]): Promise<void> {
  expect(errors, 'unexpected console/page errors').toEqual([]);
}

/** Plays a whole 60 s match instantly (manual clock) and waits for the result screen. */
export async function finishMatchByTime(page: Page): Promise<void> {
  await startMatch(page);
  await advance(page, 60_500);
  await expect(page.getByRole('heading', { name: "Time's up!" }).first()).toBeVisible();
}

export const SHORT_MATCH = { sessionTimeSec: 60, enemySpawnTimeSec: 10 };
