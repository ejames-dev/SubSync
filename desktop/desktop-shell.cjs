const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname } = require('node:path');

const DEFAULT_DESKTOP_PREFERENCES = {
  minimizeToTray: true,
  launchAtLogin: false,
};

function readDesktopPreferences(filePath) {
  try {
    if (!existsSync(filePath)) {
      return { ...DEFAULT_DESKTOP_PREFERENCES };
    }
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return {
      minimizeToTray:
        typeof parsed?.minimizeToTray === 'boolean'
          ? parsed.minimizeToTray
          : DEFAULT_DESKTOP_PREFERENCES.minimizeToTray,
      launchAtLogin:
        typeof parsed?.launchAtLogin === 'boolean'
          ? parsed.launchAtLogin
          : DEFAULT_DESKTOP_PREFERENCES.launchAtLogin,
    };
  } catch {
    return { ...DEFAULT_DESKTOP_PREFERENCES };
  }
}

function writeDesktopPreferences(filePath, update) {
  const current = readDesktopPreferences(filePath);
  const next = {
    minimizeToTray:
      typeof update?.minimizeToTray === 'boolean'
        ? update.minimizeToTray
        : current.minimizeToTray,
    launchAtLogin:
      typeof update?.launchAtLogin === 'boolean'
        ? update.launchAtLogin
        : current.launchAtLogin,
  };
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function resolveNotificationTargetUrl(baseOrigin, notification) {
  const trimmedOrigin = String(baseOrigin).replace(/\/+$/, '');
  if (
    notification &&
    typeof notification.subscriptionId === 'string' &&
    notification.subscriptionId.trim().length > 0
  ) {
    return `${trimmedOrigin}/subscriptions/${encodeURIComponent(
      notification.subscriptionId.trim(),
    )}`;
  }
  return `${trimmedOrigin}/dashboard`;
}

function buildTrayTooltipSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return 'SubSync — Local Subscription Command Center';
  }
  const upcoming =
    typeof summary.upcomingRenewalCount === 'number'
      ? summary.upcomingRenewalCount
      : 0;
  const currency = summary.budget?.currency || 'USD';
  const spend =
    typeof summary.monthlyEquivalentSpend === 'number'
      ? summary.monthlyEquivalentSpend.toFixed(2)
      : '0.00';
  return `SubSync · ${upcoming} due in 14d · ${currency} ${spend}/mo`;
}

module.exports = {
  DEFAULT_DESKTOP_PREFERENCES,
  readDesktopPreferences,
  writeDesktopPreferences,
  resolveNotificationTargetUrl,
  buildTrayTooltipSummary,
};
