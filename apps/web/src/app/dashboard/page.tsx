import { ServiceProvider, Subscription, SubscriptionEvent } from '@subscription-tracker/types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/status-badge';
import Link from 'next/link';
import { Pause } from 'lucide-react';
import { getRecentSubscriptionEvents, getServices, getSubscriptions } from '../../lib/api';
import { SubscriptionsGrid } from '../../components/subscriptions-grid';

function summarize(subscriptions: Subscription[]) {
  const monthlySpend = subscriptions
    .filter((sub) => sub.billingInterval === 'monthly')
    .reduce((sum, sub) => sum + sub.billingAmount, 0);

  const upcomingRenewals = subscriptions
    .slice()
    .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal))
    .slice(0, 3);

  return { monthlySpend, upcomingRenewals };
}

function mapServices(services: ServiceProvider[]) {
  return Object.fromEntries(services.map((service) => [service.id, service]));
}

function mapSubscriptions(subscriptions: Subscription[]) {
  return Object.fromEntries(subscriptions.map((subscription) => [subscription.id, subscription]));
}


function formatEventTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function RecentStatusChanges({
  events,
  subscriptionsById,
  servicesById,
}: {
  events: SubscriptionEvent[];
  subscriptionsById: Record<string, Subscription>;
  servicesById: Record<string, ServiceProvider>;
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-slate-500">
          No recent status changes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent status changes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => {
          const subscription = subscriptionsById[event.subscriptionId];
          const service = subscription ? servicesById[subscription.serviceId] : undefined;
          return (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {service?.name ?? subscription?.serviceId ?? 'Unknown service'}
                </p>
                <p className="text-sm text-slate-500">
                  {subscription?.planName ?? 'Subscription'}
                </p>
                <p className="text-xs text-slate-400">
                  {formatEventTimestamp(event.occurredAt)}
                </p>
              </div>
              <StatusBadge status={event.status} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  try {
    const [subscriptions, services, recentEvents] = await Promise.all([
      getSubscriptions(),
      getServices(),
      getRecentSubscriptionEvents(5),
    ]);
    const { monthlySpend, upcomingRenewals } = summarize(subscriptions);
    const servicesById = mapServices(services);
    const subscriptionsById = mapSubscriptions(subscriptions);

    return (
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">
                ${monthlySpend.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">Streaming + music</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">
                {subscriptions.length}
              </p>
              <p className="text-xs text-slate-500">Synced from Postgres</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next Renewal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">
                {upcomingRenewals[0]?.nextRenewal
                  ? new Date(upcomingRenewals[0].nextRenewal).toLocaleDateString()
                  : '—'}
              </p>
              <p className="text-xs text-slate-500">
                {servicesById[upcomingRenewals[0]?.serviceId ?? '']?.name ?? 'None'}
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Upcoming renewals
            </h2>
            <Link href="/subscriptions/new">
              <Button size="sm">Add subscription</Button>
            </Link>
          </div>
          {upcomingRenewals.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-500">
                No renewals scheduled—add a subscription to get reminders.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingRenewals.map((renewal) => {
                const service = servicesById[renewal.serviceId];
                return (
                  <Card key={renewal.id} className="flex items-center justify-between">
                    <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                      <div>
                        <p className="font-medium text-slate-900">{service?.name}</p>
                        <p className="text-sm text-slate-500">{renewal.planName}</p>
                      </div>
                      <Badge variant="warning">
                        Due {new Date(renewal.nextRenewal).toLocaleDateString()}
                      </Badge>
                    </CardContent>
                    <div className="flex gap-2 pr-4">
                      <Button variant="ghost" size="icon" aria-label="Snooze">
                        <Pause className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        Review
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <RecentStatusChanges
            events={recentEvents}
            subscriptionsById={subscriptionsById}
            servicesById={servicesById}
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Active subscriptions
            </h2>
          </div>
          <SubscriptionsGrid subscriptions={subscriptions} servicesById={servicesById} />
        </section>
      </div>
    );
  } catch (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-red-600">
          Failed to load data from the API. Ensure the Nest server is running on
          port 3001 and that `NEXT_PUBLIC_API_URL` points to it.
        </CardContent>
      </Card>
    );
  }
}
