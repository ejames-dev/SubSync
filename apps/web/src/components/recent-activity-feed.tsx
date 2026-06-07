'use client';

import { useEffect, useState } from 'react';
import type { SubscriptionEvent } from '@subscription-tracker/types';
import { getRecentSubscriptionEvents } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function RecentActivityFeed() {
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getRecentSubscriptionEvents(6)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <p className="text-sm text-slate-500">Latest subscription status changes and imports.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading activity...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500">No recent subscription events yet.</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              <p className="font-medium text-slate-900">
                {formatEventTitle(event.eventType)} · {event.status.replace('_', ' ')}
              </p>
              <p className="text-slate-500">
                {event.notes ?? 'Subscription updated'} ·{' '}
                {new Date(event.occurredAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function formatEventTitle(eventType: SubscriptionEvent['eventType']): string {
  switch (eventType) {
    case 'created':
      return 'Created';
    case 'status_changed':
      return 'Status changed';
    case 'renewal':
      return 'Renewal';
    default:
      return 'Updated';
  }
}
