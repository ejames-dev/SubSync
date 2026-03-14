'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ServiceProvider, Subscription, SubscriptionStatus } from '@subscription-tracker/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { StatusBadge } from './status-badge';

interface Props {
  subscriptions: Subscription[];
  servicesById: Record<string, ServiceProvider>;
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  canceled_pending: 'Cancels soon',
};

const STATUS_ORDER: SubscriptionStatus[] = ['active', 'trial', 'canceled_pending'];
const STATUS_NONE_VALUE = 'none';

const INITIAL_STATUS_FLAGS: Record<SubscriptionStatus, boolean> = {
  active: true,
  trial: true,
  canceled_pending: true,
};

export function SubscriptionsGrid({ subscriptions, servicesById }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramsKey = searchParams.toString();

  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [enabledStatuses, setEnabledStatuses] = useState<Record<SubscriptionStatus, boolean>>(() =>
    decodeStatusParam(searchParams.get('status')),
  );

  useEffect(() => {
    const params = new URLSearchParams(paramsKey);
    const nextQuery = params.get('q') ?? '';
    const nextStatuses = decodeStatusParam(params.get('status'));
    setQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    setEnabledStatuses((prev) => (areStatusMapsEqual(prev, nextStatuses) ? prev : nextStatuses));
  }, [paramsKey]);

  const updateUrl = (nextQuery: string, nextStatuses: Record<SubscriptionStatus, boolean>) => {
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
      { active: 0, trial: 0, canceled_pending: 0 } as Record<SubscriptionStatus, number>,
    );
  }, [subscriptions]);

  const filtered = useMemo(() => {
    return subscriptions.filter((subscription) => {
      if (!enabledStatuses[subscription.status]) return false;
      if (!query.trim()) return true;
      const haystack = `${subscription.planName} ${
        servicesById[subscription.serviceId]?.name ?? ''
      }`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [subscriptions, enabledStatuses, query, servicesById]);

  const totalCount = subscriptions.length;
  const filteredCount = filtered.length;
  const hasSearchQuery = query.trim().length > 0;
  const hasStatusFilter = STATUS_ORDER.some((status) => !enabledStatuses[status]);
  const hasActiveFilters = hasSearchQuery || hasStatusFilter;

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
    setEnabledStatuses(next);
    updateUrl('', next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          placeholder="Search by service or plan"
          value={query}
          onChange={handleQueryChange}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 md:max-w-sm"
        />
        <div className="flex flex-col gap-1 text-sm text-slate-600 md:items-end">
          <p>
            Showing <span className="font-semibold text-slate-900">{filteredCount}</span> of {totalCount}{' '}
            subscriptions
          </p>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start md:self-auto"
              onClick={resetFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => toggleStatus(status)}
            className={`rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              enabledStatuses[status]
                ? 'border-slate-200 bg-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
            aria-pressed={enabledStatuses[status]}
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{STATUS_LABELS[status]}</p>
            <p className="text-2xl font-semibold text-slate-900">{statusCounts[status]}</p>
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
            return (
              <Card key={subscription.id}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
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
                        <CardTitle>{service?.name ?? subscription.serviceId}</CardTitle>
                        <p className="text-sm text-slate-500">{subscription.planName}</p>
                      </div>
                    </div>
                    <StatusBadge status={subscription.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Updated {formatUpdatedLabel(subscription.statusChangedAt)}
                    </div>
                    <Badge variant={subscription.autoImportSource === 'oauth' ? 'success' : 'default'}>
                      {subscription.autoImportSource ?? 'manual'}
                    </Badge>
                  </div>
                  {subscription.notes && (
                    <p className="text-sm text-slate-600">“{summarizeNote(subscription.notes)}”</p>
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">
                      ${subscription.billingAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">/{subscription.billingInterval}</p>
                  </div>
                  <Link
                    href={`/subscriptions/${subscription.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Manage →
                  </Link>
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

function decodeStatusParam(param: string | null): Record<SubscriptionStatus, boolean> {
  if (!param) {
    return { ...INITIAL_STATUS_FLAGS };
  }

  if (param === STATUS_NONE_VALUE) {
    return {
      active: false,
      trial: false,
      canceled_pending: false,
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

  return STATUS_ORDER.reduce((acc, status) => {
    acc[status] = requested.includes(status);
    return acc;
  }, {} as Record<SubscriptionStatus, boolean>);
}

function encodeStatusParam(statuses: Record<SubscriptionStatus, boolean>): string | null {
  if (STATUS_ORDER.every((status) => statuses[status])) {
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
