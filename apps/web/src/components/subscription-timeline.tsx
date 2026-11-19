import { SubscriptionEvent } from '@subscription-tracker/types';
import { formatCurrency } from '../lib/utils';
import { Badge } from './ui/badge';
import { StatusBadge } from './status-badge';

interface Props {
  events: SubscriptionEvent[];
}

function formatEventLabel(event: SubscriptionEvent) {
  switch (event.eventType) {
    case 'created':
      return 'Subscription created';
    case 'status_changed':
      return 'Status updated';
    case 'renewal':
      return 'Renewal logged';
    case 'price_changed':
      return 'Price changed';
    case 'merged':
      return 'Duplicates merged';
    default: {
      const unhandled: never = event.eventType;
      return unhandled;
    }
  }
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function renderPriceDelta(event: SubscriptionEvent) {
  if (
    event.eventType === 'price_changed' &&
    event.previousAmount !== undefined &&
    event.amount !== undefined
  ) {
    const currency = event.currency ?? event.previousCurrency ?? 'USD';
    const prevCurrency = event.previousCurrency ?? currency;
    const diff = event.amount - event.previousAmount;
    const sign = diff > 0 ? '+' : '';
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-slate-700">
          {formatCurrency(event.previousAmount, prevCurrency)} &rarr;{' '}
          {formatCurrency(event.amount, currency)}
        </span>
        {prevCurrency === currency && diff !== 0 ? (
          <Badge variant={diff > 0 ? 'warning' : 'success'}>
            {sign}
            {formatCurrency(diff, currency)}
          </Badge>
        ) : null}
      </div>
    );
  }
  if (event.eventType === 'renewal' && event.amount !== undefined) {
    return (
      <p className="mt-1 text-xs font-medium text-slate-700">
        Billed {formatCurrency(event.amount, event.currency ?? 'USD')}
      </p>
    );
  }
  return null;
}

export function SubscriptionTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        No status history yet. Updates will appear here as you make changes.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-slate-900">
              {formatEventLabel(event)}
            </p>
            {renderPriceDelta(event)}
            {event.notes ? (
              <p className="mt-0.5 text-xs text-slate-600">{event.notes}</p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {formatTimestamp(event.occurredAt)}
            </p>
          </div>
          <StatusBadge status={event.status} />
        </li>
      ))}
    </ol>
  );
}
