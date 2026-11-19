import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import desktopShell from './desktop-shell.cjs';

const {
  readDesktopPreferences,
  writeDesktopPreferences,
  resolveNotificationTargetUrl,
  buildTrayTooltipSummary,
} = desktopShell;

const tempDir = mkdtempSync(join(tmpdir(), 'subsync-desktop-shell-'));

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('desktop-shell helpers', () => {
  it('persists and merges desktop preferences with safe defaults', () => {
    const prefsPath = join(tempDir, 'nested', 'desktop-preferences.json');
    assert.deepEqual(readDesktopPreferences(prefsPath), {
      minimizeToTray: true,
      launchAtLogin: false,
    });

    const updated = writeDesktopPreferences(prefsPath, { launchAtLogin: true });
    assert.deepEqual(updated, {
      minimizeToTray: true,
      launchAtLogin: true,
    });

    const updatedAgain = writeDesktopPreferences(prefsPath, {
      minimizeToTray: false,
    });
    assert.deepEqual(updatedAgain, {
      minimizeToTray: false,
      launchAtLogin: true,
    });
  });

  it('resolves deep-link URLs for subscription notifications and falls back to dashboard', () => {
    assert.equal(
      resolveNotificationTargetUrl('http://127.0.0.1:43101/', {
        subscriptionId: 'sub_netflix_1',
      }),
      'http://127.0.0.1:43101/subscriptions/sub_netflix_1',
    );
    assert.equal(
      resolveNotificationTargetUrl('http://127.0.0.1:43101', {}),
      'http://127.0.0.1:43101/dashboard',
    );
  });

  it('formats a concise tray tooltip summary', () => {
    assert.equal(
      buildTrayTooltipSummary({
        upcomingRenewalCount: 3,
        monthlyEquivalentSpend: 42.5,
        budget: { currency: 'USD' },
      }),
      'SubSync · 3 due in 14d · USD 42.50/mo',
    );
  });
});
