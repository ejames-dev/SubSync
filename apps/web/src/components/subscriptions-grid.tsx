'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BulkSubscriptionAction,
  ServiceProvider,
  Subscription,
  SubscriptionStatus,
} from '@subscription-tracker/types';
import { bulkUpdateSubscriptions, snoozeSubscription } from '../lib/api';
import { toMonthlyEquivalentClient } from '../lib/calendar';
import {
  formatCurrency,
  isRenewalSnoozed,
  isSafeExternalUrl,
} from '../lib/utils';
import { StatusBadge } from './status-badge';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  subscriptions: Subscription[];
  servicesById: Record<string, ServiceProvider>;
  onChanged?: () => Promise<void> | void;
}

type SortKey =
  | 'nextRenewal'
  | 'monthlyCost'
  | 'billingAmount'
  | 'serviceName'
  | 'updatedAt';

type PaymentFilter = 'all' | 'card' | 'paypal' | 'gift' | 'other';

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  paused: 'Paused',
  flagged_for_cancellation: 'Review to cancel',
  canceled_pending: 'Cancels soon',
  canceled: 'Canceled',
};

const STATUS_ORDER: SubscriptionStatus[] = [
  'active',
  'trial',
  'paused',
  'flagged_for_cancellation',
  'canceled_pending',
  'canceled',
];
const STATUS_NONE_VALUE = 'none';

const INITIAL_STATUS_FLAGS: Record<SubscriptionStatus, boolean> = {
  active: true,
  trial: true,
  paused: true,
  flagged_for_cancellation: true,
  canceled_pending: true,
  canceled: false,
};

export function SubscriptionsGrid({
  subscriptions,
  servicesById,
  onChanged,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramsKey = searchParams.toString();

  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [sortBy, setSortBy] = useState<SortKey>('nextRenewal');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [enabledStatuses, setEnabledStatuses] = useState<
    Record<SubscriptionStatus, boolean>
  >(() => decodeStatusParam(searchParams.get('status')));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(paramsKey);
    const nextQuery = params.get('q') ?? '';
    const nextStatuses = decodeStatusParam(params.get('status'));
    setQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    setEnabledStatuses((prev) =>
      areStatusMapsEqual(prev, nextStatuses) ? prev : nextStatuses,
    );
  }, [paramsKey]);

  const updateUrl = (
    nextQuery: string,
    nextStatuses: Record<SubscriptionStatus, boolean>,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmedQuery = nextQuery.trim();

    if (trimmedQuery.length > 0) {
      params.set('q', nextQuery);
    } else {
      params.delete('q');
    }

    const statusValue = encodeStatusParam(nextStatuses);
    if (statusValue) {
      params.set('status', statusValue);
    } else {
      params.delete('status');
    }

    const queryString = params.toString();
    const target = queryString ? `${pathname}?${queryString}` : pathname;
    const currentTarget = paramsKey ? `${pathname}?${paramsKey}` : pathname;

    if (currentTarget !== target) {
      router.replace(target, { scroll: false });
    }
  };

  const statusCounts = useMemo(() => {
    return subscriptions.reduce(
      (acc, subscription) => {
        acc[subscription.status] += 1;
        return acc;
      },
      {
        active: 0,
        trial: 0,
        paused: 0,
        flagged_for_cancellation: 0,
        canceled_pending: 0,
        canceled: 0,
      } as Record<SubscriptionStatus, number>,
    );
  }, [subscriptions]);

  const filtered = useMemo(() => {
    const matching = subscriptions.filter((subscription) => {
      if (!enabledStatuses[subscription.status]) return false;
      if (
        paymentFilter !== 'all' &&
        (subscription.paymentSource ?? 'other') !== paymentFilter
      ) {
        return false;
      }
      if (!query.trim()) return true;
      const haystack = `${subscription.planName} ${
        servicesById[subscription.serviceId]?.name ?? ''
      } ${(subscription.tags ?? []).join(' ')} ${
        subscription.paymentLast4 ?? ''
      }`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    return matching.slice().sort((a, b) => {
      switch (sortBy) {
        case 'nextRenewal':
          return a.nextRenewal.localeCompare(b.nextRenewal);
        case 'monthlyCost':
          return (
            toMonthlyEquivalentClient(
              b.billingAmount,
              b.billingInterval,
              b.customIntervalDays,
            ) -
            toMonthlyEquivalentClient(
              a.billingAmount,
              a.billingInterval,
              a.customIntervalDays,
            )
          );
        case 'billingAmount':
          return b.billingAmount - a.billingAmount;
        case 'serviceName':
          return (servicesById[a.serviceId]?.name ?? a.serviceId).localeCompare(
            servicesById[b.serviceId]?.name ?? b.serviceId,
          );
        case 'updatedAt':
          return b.statusChangedAt.localeCompare(a.statusChangedAt);
        default: {
          const exhaustive: never = sortBy;
          return exhaustive;
        }
      }
    });
  }, [
    subscriptions,
    enabledStatuses,
    paymentFilter,
    query,
    servicesById,
    sortBy,
  ]);

  const totalCount = subscriptions.length;
  const filteredCount = filtered.length;
  const hasSearchQuery = query.trim().length > 0;
  const hasStatusFilter = STATUS_ORDER.some(
    (status) => enabledStatuses[status] !== INITIAL_STATUS_FLAGS[status],
  );
  const hasActiveFilters =
    hasSearchQuery || hasStatusFilter || paymentFilter !== 'all';

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    updateUrl(value, enabledStatuses);
  };

  const toggleStatus = (status: SubscriptionStatus) => {
    setEnabledStatuses((prev) => {
      const next = {
        ...prev,
        [status]: !prev[status],
      };
      updateUrl(query, next);
      return next;
    });
  };

  const resetFilters = () => {
    const next = { ...INITIAL_STATUS_FLAGS };
    setQuery('');
    setPaymentFilter('all');
    setEnabledStatuses(next);
    updateUrl('', next);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const allSelected =
      filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((item) => item.id)));
    }
  };

  const runBulkAction = async (action: BulkSubscriptionAction) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      action === 'delete' &&
      !window.confirm(
        `Permanently delete ${ids.length} selected subscription${ids.length === 1 ? '' : 's'}?`,
      )
    ) {
      return;
    }

    setBusyAction(true);
    setGridError(null);
    try {
      await bulkUpdateSubscriptions({
        ids,
        action,
        ...(action === 'snooze' ? { snoozeDays: 7 } : {}),
      });
      setSelectedIds(new Set());
      await onChanged?.();
      router.refresh();
    } catch (err) {
      setGridError(err instanceof Error ? err.message : 'Bulk action failed.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCustomSnooze = async (id: string, days: number) => {
    setBusyAction(true);
    setGridError(null);
    try {
      await snoozeSubscription(id, days);
      await onChanged?.();
      router.refresh();
    } catch (err) {
      setGridError(err instanceof Error ? err.message : 'Failed to snooze.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Search subscriptions"
            placeholder="Search by service, plan, tag, or card last 4"
            value={query}
            onChange={handleQueryChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 sm:max-w-xs"
          />
          <select
            aria-label="Sort subscriptions"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="nextRenewal">Sort: Next renewal</option>
            <option value="monthlyCost">Sort: Monthly cost (high-low)</option>
            <option value="billingAmount">Sort: Charge amount</option>
            <option value="serviceName">Sort: Service A-Z</option>
            <option value="updatedAt">Sort: Recently updated</option>
          </select>
          <select
            aria-label="Filter by payment method"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All payment methods</option>
            <option value="card">Card</option>
            <option value="paypal">PayPal</option>
            <option value="gift">Gift</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <p>
            Showing{' '}
            <span className="font-semibold text-slate-900">
              {filteredCount}
            </span>{' '}
            of {totalCount}
          </p>
          {filtered.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleSelectAllFiltered}
            >
              {filtered.every((item) => selectedIds.has(item.id))
                ? 'Deselect all'
                : 'Select shown'}
            </Button>
          )}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-900 dark:bg-blue-950/40">
          <span className="text-sm font-medium text-slate-900">
            {selectedIds.size} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void runBulkAction('pause')}
            >
              Pause
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void runBulkAction('activate')}
            >
              Resume
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void runBulkAction('flag_cancel')}
            >
              Flag to cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void runBulkAction('snooze')}
            >
              Snooze 7d
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void runBulkAction('archive')}
            >
              Archive
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void runBulkAction('delete')}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {gridError ? (
        <p role="alert" className="text-sm text-red-600">
          {gridError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => toggleStatus(status)}
            className={`rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              enabledStatuses[status]
                ? 'border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
                : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950'
            }`}
            aria-pressed={enabledStatuses[status]}
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {STATUS_LABELS[status]}
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {statusCounts[status]}
            </p>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-slate-500">
            No subscriptions match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((subscription) => {
            const service = servicesById[subscription.serviceId];
            const snoozed = isRenewalSnoozed(subscription);
            return (
              <Card key={subscription.id}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${service?.name ?? subscription.planName}`}
                        checked={selectedIds.has(subscription.id)}
                        onChange={() => toggleSelect(subscription.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {service?.logoUrl ? (
                        <Image
                          src={service.logoUrl}
                          alt={service.name ?? subscription.serviceId}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50" />
                      )}
                      <div>
                        <CardTitle>
                          {service?.name ?? subscription.serviceId}
                        </CardTitle>
                        <p className="text-sm text-slate-500">
                          {subscription.planName}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={subscription.status} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      Next: {subscription.nextRenewal.slice(0, 10)} · Updated{' '}
                      {formatUpdatedLabel(subscription.statusChangedAt)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {snoozed && subscription.snoozedUntil ? (
                        <Badge variant="warning">
                          Snoozed until {subscription.snoozedUntil.slice(0, 10)}
                        </Badge>
                      ) : null}
                      <Badge
                        variant={
                          subscription.autoImportSource === 'oauth'
                            ? 'success'
                            : 'default'
                        }
                      >
                        {subscription.autoImportSource ?? 'manual'}
                      </Badge>
                    </div>
                  </div>
                  {subscription.tags && subscription.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {subscription.tags.map((tag) => (
                        <Badge key={tag} variant="default">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {subscription.status === 'trial' && (
                    <p className="text-xs font-medium text-amber-700">
                      Trial ends{' '}
                      {(
                        subscription.trialEndsAt ?? subscription.nextRenewal
                      ).slice(0, 10)}
                      {subscription.postTrialAmount !== undefined
                        ? ` · then ${formatCurrency(
                            subscription.postTrialAmount,
                            subscription.billingCurrency,
                          )}`
                        : ''}
                    </p>
                  )}
                  {subscription.notes && (
                    <p className="text-sm text-slate-600">
                      &ldquo;{summarizeNote(subscription.notes)}&rdquo;
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">
                      {formatCurrency(
                        subscription.billingAmount,
                        subscription.billingCurrency,
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      /{subscription.billingInterval}
                      {subscription.billingInterval === 'custom' &&
                      subscription.customIntervalDays
                        ? ` (${subscription.customIntervalDays}d)`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Snooze reminders"
                        value=""
                        disabled={busyAction}
                        onChange={(e) => {
                          const days = Number(e.target.value);
                          if (days > 0) {
                            void handleCustomSnooze(subscription.id, days);
                          }
                        }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                      >
                        <option value="">Snooze…</option>
                        <option value="3">3 days</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                      </select>
                      <Link
                        href={`/subscriptions/${subscription.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Manage &rarr;
                      </Link>
                    </div>
                    {service?.cancelUrl &&
                      isSafeExternalUrl(service.cancelUrl) && (
                        <a
                          href={service.cancelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                        >
                          Cancellation guide &nearr;
                        </a>
                      )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatUpdatedLabel(timestamp: string) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function summarizeNote(note: string) {
  return note.length > 120 ? `${note.slice(0, 117)}…` : note;
}

function decodeStatusParam(
  param: string | null,
): Record<SubscriptionStatus, boolean> {
  if (!param) {
    return { ...INITIAL_STATUS_FLAGS };
  }

  if (param === STATUS_NONE_VALUE) {
    return {
      active: false,
      trial: false,
      paused: false,
      flagged_for_cancellation: false,
      canceled_pending: false,
      canceled: false,
    };
  }

  const requested = param
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is SubscriptionStatus =>
      STATUS_ORDER.includes(value as SubscriptionStatus),
    );

  if (requested.length === 0) {
    return { ...INITIAL_STATUS_FLAGS };
  }

  return STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = requested.includes(status);
      return acc;
    },
    {} as Record<SubscriptionStatus, boolean>,
  );
}

function encodeStatusParam(
  statuses: Record<SubscriptionStatus, boolean>,
): string | null {
  if (
    STATUS_ORDER.every(
      (status) => statuses[status] === INITIAL_STATUS_FLAGS[status],
    )
  ) {
    return null;
  }

  const enabled = STATUS_ORDER.filter((status) => statuses[status]);
  if (enabled.length === 0) {
    return STATUS_NONE_VALUE;
  }

  return enabled.join(',');
}

function areStatusMapsEqual(
  a: Record<SubscriptionStatus, boolean>,
  b: Record<SubscriptionStatus, boolean>,
) {
  return STATUS_ORDER.every((status) => a[status] === b[status]);
}
