'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ServiceProvider, Subscription } from '@subscription-tracker/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getApiBaseUrl, listServices, listSubscriptions } from '../lib/api';
import { projectMonthOccurrences } from '../lib/calendar';
import { formatCurrency } from '../lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RenewalCalendarClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getUTCMonth());
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listSubscriptions(), listServices()])
      .then(([subs, svcs]) => {
        setSubscriptions(subs);
        setServices(svcs);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Could not load calendar data.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const servicesById = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s])),
    [services],
  );

  const occurrences = useMemo(
    () =>
      projectMonthOccurrences(subscriptions, servicesById, year, monthIndex),
    [subscriptions, servicesById, year, monthIndex],
  );

  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, typeof occurrences>();
    for (const occ of occurrences) {
      map.set(occ.dateKey, [...(map.get(occ.dateKey) ?? []), occ]);
    }
    return map;
  }, [occurrences]);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const occ of occurrences) {
      map.set(occ.currency, (map.get(occ.currency) ?? 0) + occ.amount);
    }
    return Array.from(map.entries());
  }, [occurrences]);

  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthLabel = new Date(
    Date.UTC(year, monthIndex, 1),
  ).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const todayKey = new Date().toISOString().slice(0, 10);

  const goPrevMonth = () => {
    if (monthIndex === 0) {
      setYear((y) => y - 1);
      setMonthIndex(11);
    } else {
      setMonthIndex((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (monthIndex === 11) {
      setYear((y) => y + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex((m) => m + 1);
    }
  };

  const goToday = () => {
    const current = new Date();
    setYear(current.getUTCFullYear());
    setMonthIndex(current.getUTCMonth());
  };

  const cells: Array<{ day: number | null; dateKey?: string }> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateKey });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Renewal calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Visualize recurring billing dates, trial conversions, and monthly
            cash-out days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${getApiBaseUrl()}/calendar/renewals.ics`}
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Download .ics feed
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void navigator.clipboard.writeText(
                `${getApiBaseUrl()}/calendar/renewals.ics`,
              )
            }
          >
            Copy .ics URL
          </Button>
          <Button variant="outline" size="sm" onClick={goPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold text-slate-900">
            {monthLabel}
          </span>
          <Button variant="outline" size="sm" onClick={goNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Scheduled events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">
              {occurrences.length}
            </p>
            <p className="text-xs text-slate-500">In {monthLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projected cash-out</CardTitle>
          </CardHeader>
          <CardContent>
            {totalsByCurrency.length === 0 ? (
              <p className="text-2xl font-semibold text-slate-900">$0.00</p>
            ) : (
              <div className="space-y-1">
                {totalsByCurrency.map(([cur, amt]) => (
                  <p
                    key={cur}
                    className="text-2xl font-semibold text-slate-900"
                  >
                    {formatCurrency(amt, cur)}
                  </p>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">Total billed in month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trial conversions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">
              {occurrences.filter((o) => o.isTrialEnd).length}
            </p>
            <p className="text-xs text-slate-500">
              Trials ending during {monthLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            Loading renewal calendar...
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-4">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-7 gap-2 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {WEEKDAYS.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((cell, index) => {
                if (!cell.day || !cell.dateKey) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-24 rounded-lg bg-slate-50/60"
                    />
                  );
                }
                const dayItems = occurrencesByDate.get(cell.dateKey) ?? [];
                const isToday = cell.dateKey === todayKey;
                return (
                  <div
                    key={cell.dateKey}
                    className={`min-h-24 rounded-lg border p-2 ${
                      isToday
                        ? 'border-blue-500 ring-1 ring-blue-400'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          isToday ? 'text-blue-600' : 'text-slate-600'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayItems.length > 0 ? (
                        <span className="text-[10px] font-medium text-slate-400">
                          {dayItems.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      {dayItems.map((item, idx) => (
                        <Link
                          key={`${item.subscriptionId}-${idx}`}
                          href={`/subscriptions/${item.subscriptionId}`}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition hover:opacity-80 ${
                            item.isTrialEnd
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200'
                              : item.status === 'canceled_pending'
                                ? 'bg-slate-200 text-slate-700 line-through dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
                          }`}
                          title={`${item.serviceName} (${item.planName}) — ${formatCurrency(item.amount, item.currency)}`}
                        >
                          {item.serviceName} ·{' '}
                          {formatCurrency(item.amount, item.currency)}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monthly agenda ({monthLabel})</CardTitle>
        </CardHeader>
        <CardContent>
          {occurrences.length === 0 ? (
            <p className="text-sm text-slate-500">
              No scheduled renewals in {monthLabel}.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {occurrences.map((item, idx) => (
                <div
                  key={`${item.subscriptionId}-agenda-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500">
                      {item.dateKey}
                    </span>
                    <Link
                      href={`/subscriptions/${item.subscriptionId}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {item.serviceName}
                    </Link>
                    <span className="text-slate-500">{item.planName}</span>
                    {item.isTrialEnd ? (
                      <Badge variant="warning">Trial ends</Badge>
                    ) : null}
                  </div>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(item.amount, item.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
