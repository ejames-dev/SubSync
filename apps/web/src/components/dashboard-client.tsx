'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  DashboardSummary,
  ServiceProvider,
  Subscription,
} from '@subscription-tracker/types';
import { Pause, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  createSubscription,
  deleteSubscription,
  getDashboardSummary,
  listServices,
  listSubscriptions,
} from '../lib/api';

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
      const [serviceData, subscriptionData, dashboardSummary] = await Promise.all([
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
      setError(loadError instanceof Error ? loadError.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const servicesById = Object.fromEntries(services.map((service) => [service.id, service]));
  const upcomingRenewals = subscriptions
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
        submitError instanceof Error ? submitError.message : 'Failed to create subscription.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteSubscription(id);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete subscription.',
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
              ${(summary?.monthlyEquivalentSpend ?? 0).toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">Normalized monthly equivalent</p>
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
                <p className="text-xs text-slate-500">Used for reminder prioritization</p>
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
              <Button variant="outline" size="sm" onClick={() => void loadData()}>
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
                  <CardContent>No subscriptions yet. Add one to populate the dashboard.</CardContent>
                </Card>
              ) : (
                upcomingRenewals.map((renewal) => {
                  const service = servicesById[renewal.serviceId];
                  return (
                    <Card key={renewal.id} className="flex items-center justify-between">
                      <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                        <div>
                          <p className="font-medium text-slate-900">
                            {service?.name ?? renewal.serviceId}
                          </p>
                          <p className="text-sm text-slate-500">{renewal.planName}</p>
                        </div>
                        <Badge variant="warning">Due {renewal.nextRenewal.slice(0, 10)}</Badge>
                      </CardContent>
                      <div className="flex gap-2 pr-4">
                        <Button variant="ghost" size="icon" aria-label="Refresh reminder">
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
              <CardContent className="space-y-3">
                {summary?.spendByCategory.length ? (
                  summary.spendByCategory.map((entry) => (
                    <div
                      key={entry.category}
                      className="flex items-center justify-between text-sm text-slate-700"
                    >
                      <span className="capitalize">{entry.category}</span>
                      <span>${entry.monthlyEquivalentSpend.toFixed(2)}/mo</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No category spend yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Attention Needed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary?.duplicateSubscriptions.length ? (
                  summary.duplicateSubscriptions.map((entry) => (
                    <div key={entry.serviceId} className="text-sm text-slate-700">
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

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Active subscriptions
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {subscriptions.map((subscription) => {
                const service = servicesById[subscription.serviceId];
                return (
                  <Card key={subscription.id}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{service?.name ?? subscription.serviceId}</CardTitle>
                        <p className="text-sm text-slate-500">{subscription.planName}</p>
                      </div>
                      <Badge
                        variant={
                          subscription.autoImportSource === 'oauth'
                            ? 'success'
                            : subscription.autoImportSource === 'email'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {subscription.autoImportSource ?? 'manual'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          ${subscription.billingAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">/{subscription.billingInterval}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete(subscription.id)}
                      >
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
                  onChange={(event) => setDraft({ ...draft, serviceId: event.target.value })}
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
                  onChange={(event) => setDraft({ ...draft, planName: event.target.value })}
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
                    onChange={(event) => setDraft({ ...draft, billingAmount: event.target.value })}
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
                        billingInterval: event.target.value as Subscription['billingInterval'],
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
                    onChange={(event) => setDraft({ ...draft, nextRenewal: event.target.value })}
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
                        paymentSource: event.target.value as DraftSubscription['paymentSource'],
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
                    onChange={(event) => setDraft({ ...draft, paymentLast4: event.target.value })}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Notes
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" disabled={saving || loading || services.length === 0}>
                {saving ? 'Saving...' : 'Save subscription'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
