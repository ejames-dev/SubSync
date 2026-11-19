'use client';

import { useEffect } from 'react';
import { claimPendingNotifications } from '../lib/api';
import { getDesktopBridge } from '../lib/desktop-bridge';

const POLL_INTERVAL_MS = 60_000;

async function deliverPendingNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (getDesktopBridge()) {
    return;
  }

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const claimed = await claimPendingNotifications();
  for (const notification of claimed) {
    const toast = new Notification(notification.title, {
      body: notification.body,
    });
    toast.onclick = () => {
      window.focus();
      const target = notification.subscriptionId
        ? `/subscriptions/${encodeURIComponent(notification.subscriptionId)}`
        : '/dashboard';
      window.location.assign(target);
    };
  }
}

export function NotificationPoller() {
  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) {
        return;
      }

      try {
        await deliverPendingNotifications();
      } catch {
        // Ignore transient API errors while the local API is starting.
      }
    }

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
