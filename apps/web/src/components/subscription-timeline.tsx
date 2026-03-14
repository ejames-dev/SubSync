import { SubscriptionEvent } from '@subscription-tracker/types';
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
    default:
      return 'Event';
  }
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
          className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-slate-900">{formatEventLabel(event)}</p>
            <p className="text-xs text-slate-500">{formatTimestamp(event.occurredAt)}</p>
          </div>
          <StatusBadge status={event.status} />
        </li>
      ))}
    </ol>
  );
}
