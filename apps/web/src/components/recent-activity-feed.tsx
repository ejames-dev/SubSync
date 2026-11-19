'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SubscriptionEvent } from '@subscription-tracker/types';
import { getRecentSubscriptionEvents } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function RecentActivityFeed({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getRecentSubscriptionEvents(6)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <p className="text-sm text-slate-500">
          Latest subscription status changes, renewals, and price updates.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading activity...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500">
            No recent subscription events yet.
          </p>
        ) : (
          events.map((event) => {
            const hasPriceDelta =
              event.eventType === 'price_changed' &&
              event.previousAmount !== undefined &&
              event.amount !== undefined;
            const currency = event.currency ?? event.previousCurrency ?? 'USD';
            const delta =
              hasPriceDelta &&
              event.amount !== undefined &&
              event.previousAmount !== undefined
                ? event.amount - event.previousAmount
                : 0;

            return (
              <div
                key={event.id}
                className="flex items-start justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {formatEventTitle(event.eventType)} ·{' '}
                      {event.status.replace(/_/g, ' ')}
                    </p>
                    {hasPriceDelta && delta !== 0 ? (
                      <Badge variant={delta > 0 ? 'warning' : 'success'}>
                        {delta > 0 ? '+' : ''}
                        {formatCurrency(delta, currency)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-slate-500">
                    {event.notes ?? 'Subscription updated'} ·{' '}
                    {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/subscriptions/${event.subscriptionId}`}
                  className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                >
                  View &rarr;
                </Link>
              </div>
            );
          })
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
    case 'price_changed':
      return 'Price changed';
    case 'merged':
      return 'Duplicates merged';
    default: {
      const unhandled: never = eventType;
      return unhandled;
    }
  }
}
