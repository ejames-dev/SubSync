'use client';

import { Suspense, type FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import type {
  DashboardSummary,
  ServiceProvider,
  Subscription,
} from '@subscription-tracker/types';
import { Pause, Trash2 } from 'lucide-react';
import {
  createSubscription,
  deleteSubscription,
  getDashboardSummary,
  listServices,
  listSubscriptions,
  snoozeSubscription,
} from '../lib/api';
import { formatCurrency, isRenewalSnoozed } from '../lib/utils';
import { RecentActivityFeed } from './recent-activity-feed';
import { SubscriptionsGrid } from './subscriptions-grid';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type DraftSubscription = {
  serviceId: string;
  planName: string;
  billingAmount: string;
  billingCurrency: string;
  billingInterval: Subscription['billingInterval'];
  nextRenewal: string;
  paymentSource: NonNullable<Subscription['paymentSource']>;
  paymentLast4: string;
  notes: string;
};

const emptyDraft: DraftSubscription = {
  serviceId: '',
  planName: '',
  billingAmount: '',
  billingCurrency: 'USD',
  billingInterval: 'monthly',
  nextRenewal: '',
  paymentSource: 'card',
  paymentLast4: '',
  notes: '',
};

type SpendCategory = DashboardSummary['spendByCategory'][number]['category'];

const categoryLabels: Record<SpendCategory, string> = {
  streaming: 'Streaming',
  music: 'Music',
  gaming: 'Gaming',
  other: 'Other',
};

const categoryStyles: Record<
  SpendCategory,
  { bar: string; bg: string; dot: string }
> = {
  streaming: {
    bar: 'bg-cyan-500',
    bg: 'bg-cyan-50',
    dot: 'bg-cyan-500',
  },
  music: {
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
  },
  gaming: {
    bar: 'bg-amber-500',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  other: {
    bar: 'bg-slate-500',
    bg: 'bg-slate-100',
    dot: 'bg-slate-500',
  },
};

export function DashboardClient() {
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [draft, setDraft] = useState<DraftSubscription>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [serviceData, subscriptionData, dashboardSummary] =
        await Promise.all([
          listServices(),
          listSubscriptions(),
          getDashboardSummary(),
        ]);
      setServices(serviceData);
      setSubscriptions(subscriptionData);
      setSummary(dashboardSummary);
      setDraft((current) => ({
        ...current,
        serviceId: current.serviceId || serviceData[0]?.id || '',
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const servicesById = Object.fromEntries(
    services.map((service) => [service.id, service])
  );
  const upcomingRenewals = subscriptions
    .filter((subscription) => !isRenewalSnoozed(subscription))
    .slice()
    .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal))
    .slice(0, 3);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createSubscription({
        serviceId: draft.serviceId,
        planName: draft.planName,
        billingAmount: Number(draft.billingAmount),
        billingCurrency: draft.billingCurrency,
        billingInterval: draft.billingInterval,
        nextRenewal: `${draft.nextRenewal}T00:00:00.000Z`,
        paymentSource: draft.paymentSource,
        paymentLast4: draft.paymentLast4 || undefined,
        autoImportSource: 'manual',
        notes: draft.notes || undefined,
      });
      setDraft({
        ...emptyDraft,
        billingCurrency: draft.billingCurrency,
        serviceId: services[0]?.id ?? '',
      });
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to create subscription.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSnooze(id: string) {
    setError(null);
    try {
      await snoozeSubscription(id, 7);
      await loadData();
    } catch (snoozeError) {
      setError(
        snoozeError instanceof Error
          ? snoozeError.message
          : 'Failed to snooze renewal.'
      );
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteSubscription(id);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete subscription.'
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">
              {formatCurrency(
                summary?.budget.monthlyEquivalentSpend ?? 0,
                summary?.budget.currency
              )}
            </p>
            <p className="text-xs text-slate-500">
              Normalized monthly equivalent
              {summary?.budget.excludedCurrencyCount
                ? ` · ${summary.budget.excludedCurrencyCount} other-currency plan${summary.budget.excludedCurrencyCount === 1 ? '' : 's'} excluded`
                : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Services</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">
              {summary?.activeSubscriptions ?? subscriptions.length}
            </p>
            <p className="text-xs text-slate-500">
              {summary
                ? `${summary.sourceBreakdown.manual} manual, ${summary.sourceBreakdown.email} email, ${summary.sourceBreakdown.oauth} oauth`
                : 'Loading source breakdown'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next Renewal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">
              {summary?.nextRenewal?.nextRenewal.slice(0, 10) ?? '—'}
            </p>
            <p className="text-xs text-slate-500">
              {summary?.nextRenewal?.serviceName ?? 'No subscriptions yet'}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary?.budget.threshold === undefined ? (
              <p className="text-sm text-slate-500">
                Set a monthly threshold in Settings to enable budget alerts.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-semibold text-slate-900">
                    {formatCurrency(
                      summary.budget.monthlyEquivalentSpend,
                      summary.budget.currency
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    of{' '}
                    {formatCurrency(
                      summary.budget.threshold,
                      summary.budget.currency
                    )}
                  </p>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                  aria-label={`${summary.budget.percentUsed ?? 0}% of monthly budget used`}
                >
                  <div
                    className={`h-full rounded-full ${summary.budget.overBudget ? 'bg-red-500' : 'bg-cyan-500'}`}
                    style={{
                      width: `${Math.min(summary.budget.percentUsed ?? 0, 100)}%`,
                    }}
                  />
                </div>
                <p
                  className={`text-xs ${summary.budget.overBudget ? 'text-red-600' : 'text-slate-500'}`}
                >
                  {summary.budget.percentUsed}% used
                  {summary.budget.overBudget
                    ? ' · Budget threshold reached'
                    : ''}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rolling 3-Month Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastSummary forecast={summary?.forecast} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming in 14 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900">
                  {summary?.upcomingRenewalCount ?? 0}
                </p>
                <p className="text-xs text-slate-500">
                  Used for reminder prioritization
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Duplicate Plans</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900">
                  {summary?.duplicateSubscriptions.length ?? 0}
                </p>
                <p className="text-xs text-slate-500">
                  {summary?.duplicateSubscriptions[0]
                    ? `${summary.duplicateSubscriptions[0].serviceName} has ${summary.duplicateSubscriptions[0].count} active entries`
                    : 'No duplicate services detected'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Upcoming renewals
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadData()}
              >
                Refresh
              </Button>
            </div>
            <div className="space-y-3">
              {loading ? (
                <Card>
                  <CardContent>Loading subscriptions...</CardContent>
                </Card>
              ) : upcomingRenewals.length === 0 ? (
                <Card>
                  <CardContent>
                    No subscriptions yet. Add one to populate the dashboard.
                  </CardContent>
                </Card>
              ) : (
                upcomingRenewals.map((renewal) => {
                  const service = servicesById[renewal.serviceId];
                  return (
                    <Card
                      key={renewal.id}
                      className="flex items-center justify-between"
                    >
                      <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                        <div className="flex items-center gap-3">
                          {service?.logoUrl ? (
                            <Image
                              src={service.logoUrl}
                              alt={service.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                            />
                          ) : null}
                          <div>
                            <p className="font-medium text-slate-900">
                              {service?.name ?? renewal.serviceId}
                            </p>
                            <p className="text-sm text-slate-500">
                              {renewal.planName} ·{' '}
                              {formatCurrency(
                                renewal.billingAmount,
                                renewal.billingCurrency
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge variant="warning">
                          Due {renewal.nextRenewal.slice(0, 10)}
                        </Badge>
                      </CardContent>
                      <div className="flex gap-2 pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Snooze renewal for 7 days"
                          onClick={() => void handleSnooze(renewal.id)}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Delete subscription"
                          onClick={() => void handleDelete(renewal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spend by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <SpendByCategoryChart
                  entries={summary?.spendByCategory ?? []}
                  currency={summary?.budget.currency ?? 'USD'}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Attention Needed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary?.duplicateSubscriptions.length ? (
                  summary.duplicateSubscriptions.map((entry) => (
                    <div
                      key={entry.serviceId}
                      className="text-sm text-slate-700"
                    >
                      <p className="font-medium">{entry.serviceName}</p>
                      <p className="text-slate-500">
                        {entry.count} active subscriptions should be reviewed.
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No duplicate subscriptions are currently flagged.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <RecentActivityFeed />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Active subscriptions
              </h2>
            </div>
            <Suspense
              fallback={
                <Card>
                  <CardContent className="py-6 text-sm text-slate-500">
                    Loading subscriptions...
                  </CardContent>
                </Card>
              }
            >
              <SubscriptionsGrid
                subscriptions={subscriptions}
                servicesById={servicesById}
              />
            </Suspense>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add subscription</CardTitle>
            <p className="text-sm text-slate-500">
              This writes directly to the local SQLite-backed API.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-slate-700">
                Service
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={draft.serviceId}
                  onChange={(event) =>
                    setDraft({ ...draft, serviceId: event.target.value })
                  }
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Plan name
                <input
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={draft.planName}
                  onChange={(event) =>
                    setDraft({ ...draft, planName: event.target.value })
                  }
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Amount
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draft.billingAmount}
                    onChange={(event) =>
                      setDraft({ ...draft, billingAmount: event.target.value })
                    }
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Currency
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draft.billingCurrency}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        billingCurrency: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Interval
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draft.billingInterval}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        billingInterval: event.target
                          .value as Subscription['billingInterval'],
                      })
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Next renewal
                  <input
                    required
                    type="date"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draft.nextRenewal}
                    onChange={(event) =>
                      setDraft({ ...draft, nextRenewal: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Payment source
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draft.paymentSource}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        paymentSource: event.target
                          .value as DraftSubscription['paymentSource'],
                      })
                    }
                  >
                    <option value="card">Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="gift">Gift</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Last 4 digits
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draft.paymentLast4}
                    onChange={(event) =>
                      setDraft({ ...draft, paymentLast4: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Notes
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft({ ...draft, notes: event.target.value })
                  }
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button
                type="submit"
                disabled={saving || loading || services.length === 0}
              >
                {saving ? 'Saving...' : 'Save subscription'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ForecastSummary({
  forecast,
}: {
  forecast?: DashboardSummary['forecast'];
}) {
  if (!forecast) {
    return (
      <p className="text-sm text-slate-500">Calculating known renewals...</p>
    );
  }

  const maxAmount = Math.max(
    ...forecast.months.map((month) => month.amount),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-semibold text-slate-900">
          {formatCurrency(forecast.total, forecast.currency)}
        </p>
        <p className="text-xs text-slate-500">
          Known renewals through {forecast.horizonEnd.slice(0, 10)}
          {forecast.excludedCurrencyCount
            ? ` · ${forecast.excludedCurrencyCount} other-currency plan${forecast.excludedCurrencyCount === 1 ? '' : 's'} excluded`
            : ''}
        </p>
      </div>
      <div className="space-y-3">
        {forecast.months.map((month) => (
          <div
            key={month.month}
            className="grid grid-cols-[4rem_1fr_auto] items-center gap-3"
          >
            <p className="text-xs font-medium text-slate-600">
              {new Date(`${month.month}-01T00:00:00.000Z`).toLocaleDateString(
                'en-US',
                { month: 'short', timeZone: 'UTC' }
              )}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${maxAmount ? Math.max((month.amount / maxAmount) * 100, month.amount ? 4 : 0) : 0}%`,
                }}
              />
            </div>
            <p className="min-w-20 text-right text-xs text-slate-600">
              {formatCurrency(month.amount, forecast.currency)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpendByCategoryChart({
  entries,
  currency,
}: {
  entries: DashboardSummary['spendByCategory'];
  currency: string;
}) {
  const positiveEntries = entries.filter(
    (entry) => entry.monthlyEquivalentSpend > 0
  );
  const total = positiveEntries.reduce(
    (sum, entry) => sum + entry.monthlyEquivalentSpend,
    0
  );
  const maxSpend = Math.max(
    ...positiveEntries.map((entry) => entry.monthlyEquivalentSpend),
    0
  );

  if (!positiveEntries.length || total <= 0 || maxSpend <= 0) {
    return <p className="text-sm text-slate-500">No category spend yet.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm text-slate-500">Monthly category mix</p>
          <p className="text-sm font-medium text-slate-700">
            {formatCurrency(total, currency)}/mo
          </p>
        </div>
        <div
          className="flex h-3 overflow-hidden rounded-full bg-slate-100"
          aria-label={`Monthly category spend totals ${formatCurrency(total, currency)}`}
        >
          {positiveEntries.map((entry) => {
            const percent = (entry.monthlyEquivalentSpend / total) * 100;
            return (
              <div
                key={entry.category}
                className={categoryStyles[entry.category].bar}
                style={{ width: `${Math.max(percent, 3)}%` }}
                title={`${categoryLabels[entry.category]}: ${formatCurrency(
                  entry.monthlyEquivalentSpend,
                  currency
                )}/mo`}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {positiveEntries.map((entry) => {
          const percentOfTotal = Math.round(
            (entry.monthlyEquivalentSpend / total) * 100
          );
          const percentOfMax = (entry.monthlyEquivalentSpend / maxSpend) * 100;
          const styles = categoryStyles[entry.category];

          return (
            <div key={entry.category} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`}
                  />
                  <span className="truncate font-medium text-slate-800">
                    {categoryLabels[entry.category]}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-slate-900">
                    {formatCurrency(entry.monthlyEquivalentSpend, currency)}/mo
                  </p>
                  <p className="text-xs text-slate-500">{percentOfTotal}%</p>
                </div>
              </div>
              <div className={`h-2 overflow-hidden rounded-full ${styles.bg}`}>
                <div
                  className={`h-full rounded-full ${styles.bar}`}
                  style={{ width: `${Math.max(percentOfMax, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
