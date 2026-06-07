'use client';

import { useEffect } from 'react';
import { acknowledgeNotification, getPendingNotifications } from '../lib/api';

const POLL_INTERVAL_MS = 60_000;

async function deliverPendingNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const pending = await getPendingNotifications();
  for (const notification of pending) {
    new Notification(notification.title, { body: notification.body });
    await acknowledgeNotification(notification.id);
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
