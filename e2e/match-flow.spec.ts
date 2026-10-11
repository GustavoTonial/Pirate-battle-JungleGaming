import { expect, test } from '@playwright/test';
import { advance, ARENA_QUERY, arrange, expectNoErrors, finishMatchByTime, openApp, SHORT_MATCH, startMatch, state } from './helpers';

test.describe('End of match, restart, pause', () => {
  test('ends by time, freezes the simulation and shows the result', async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY, options: SHORT_MATCH });
    await startMatch(page);
    await advance(page, 60_500);
    const s = await state(page);
    expect(s.status).toBe('ended');
    expect(s.endReason).toBe('time');
    await page.keyboard.down('KeyW');
    await advance(page, 2000);
    await page.keyboard.up('KeyW');
    const after = await state(page);
    expect(after.time).toBe(s.time);
    expect(after.player.x).toBe(s.player.x);

    await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
    await expect(page.getByTestId('result-duration')).toHaveText('1:00');
    await expect(page.getByTestId('result-reason')).toHaveText('Time ran out');
    await expect(page.getByTestId('result-score')).toHaveText('0');
  });

  test('ends by death and Play Again starts a clean match', async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY, options: SHORT_MATCH });
    await startMatch(page);
    await arrange(page, { player: { x: 800, y: 600, health: 2 }, enemies: [{ kind: 'chaser', x: 810, y: 600, heading: 0 }] });
    await advance(page, 500);
    expect((await state(page)).endReason).toBe('death');
    await expect(page.getByRole('heading', { name: 'Ship sunk!' })).toBeVisible();
    await expect(page.getByTestId('result-reason')).toHaveText('Ship sunk');

    await page.getByRole('button', { name: 'Play Again' }).click();
    await page.waitForFunction(() => window.__PB__?.state().status === 'running');
    const s = await state(page);
    expect(s.player.health).toBe(10);
    expect(s.score).toBe(0);
    expect(s.time).toBeLessThan(0.1);
    expect(s.enemies).toHaveLength(0);
    expect(s.projectiles).toHaveLength(0);
  });

  test('manual pause freezes time and cooldowns; resume needs an action and drops held input', async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY });
    await startMatch(page);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Space');
    await advance(page, 300);
    await page.getByRole('button', { name: 'Pause' }).click();
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();
    const paused = await state(page);
    expect(paused.status).toBe('paused');
    await advance(page, 5000);
    const still = await state(page);
    expect(still.time).toBe(paused.time);
    expect(still.player.cdFront).toBe(paused.player.cdFront);
    expect(still.player.x).toBe(paused.player.x);

    await page.keyboard.up('KeyW');
    await page.keyboard.up('Space');
    await dialog.getByRole('button', { name: 'Resume' }).click();
    await expect(dialog).toBeHidden();
    await advance(page, 1000);
    const resumed = await state(page);
    expect(resumed.status).toBe('running');
    expect(resumed.time - paused.time).toBeLessThan(1.05); // nothing accumulated while paused
    expect(resumed.player.speed).toBeLessThan(paused.player.speed); // held keys were dropped
  });

  test('pauses automatically on blur and when the tab is hidden', async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY });
    await startMatch(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    expect((await state(page)).status).toBe('paused');
  });

  test('Escape pauses, and game keys are not captured outside gameplay', async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY });
    // In the menu, Space must keep its normal behavior (activating the focused button), not be swallowed.
    const prevented = await page.evaluate(() => {
      const ev = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true, bubbles: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await startMatch(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  });
});

test.describe('Result persistence and abandoning', () => {
  test('result survives a refresh', async ({ page }) => {
    await openApp(page, { query: ARENA_QUERY, options: SHORT_MATCH });
    await finishMatchByTime(page);
    await expect(page.getByTestId('record-status')).toContainText('saved');
    await page.reload();
    await expect(page.getByTestId('last-result')).toContainText('0');
    await page.getByRole('button', { name: 'View' }).click();
    await expect(page.getByTestId('result-reason')).toHaveText('Time ran out');
    await expect(page.getByTestId('result-duration')).toHaveText('1:00');
  });

  test('abandoning a match records nothing; repeated navigation stays clean', async ({ page }) => {
    const errors = await openApp(page, { query: ARENA_QUERY });
    for (let i = 0; i < 3; i++) {
      await startMatch(page);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Main Menu' }).click();
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    }
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText("You haven't finished a match yet.")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('last-result')).toHaveCount(0);
    await expectNoErrors(errors);
  });
});
