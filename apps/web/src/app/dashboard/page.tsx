import { Subscription, ServiceProvider } from '@subscription-tracker/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Pause } from 'lucide-react';

const mockServices: ServiceProvider[] = [
  {
    id: 'svc_spotify',
    name: 'Spotify',
    category: 'music',
    supportsOAuth: true,
  },
  {
    id: 'svc_netflix',
    name: 'Netflix',
    category: 'streaming',
    supportsOAuth: false,
  },
  {
    id: 'svc_disney_plus',
    name: 'Disney+',
    category: 'streaming',
    supportsOAuth: false,
  },
];

const mockSubscriptions: Subscription[] = [
  {
    id: 'sub_spotify',
    serviceId: 'svc_spotify',
    planName: 'Premium Duo',
    status: 'active',
    billingAmount: 14.99,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: '2026-04-02',
    autoImportSource: 'oauth',
  },
  {
    id: 'sub_netflix',
    serviceId: 'svc_netflix',
    planName: 'Standard',
    status: 'active',
    billingAmount: 15.49,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: '2026-03-18',
    paymentSource: 'card',
    paymentLast4: '4242',
    autoImportSource: 'email',
  },
  {
    id: 'sub_disney',
    serviceId: 'svc_disney_plus',
    planName: 'Annual',
    status: 'active',
    billingAmount: 139.99,
    billingCurrency: 'USD',
    billingInterval: 'yearly',
    nextRenewal: '2026-11-01',
  },
];

const servicesById = Object.fromEntries(
  mockServices.map((service) => [service.id, service]),
);

const monthlySpend = mockSubscriptions
  .filter((sub) => sub.billingInterval === 'monthly')
  .reduce((sum, sub) => sum + sub.billingAmount, 0);

const upcomingRenewals = mockSubscriptions
  .slice()
  .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal))
  .slice(0, 3);

export default function DashboardPage() {
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
              {mockSubscriptions.length}
            </p>
            <p className="text-xs text-slate-500">Auto-import 2 / Manual 1</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next Renewal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">
              {upcomingRenewals[0]?.nextRenewal ?? '—'}
            </p>
            <p className="text-xs text-slate-500">
              {servicesById[upcomingRenewals[0]?.serviceId ?? '']?.name}
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Upcoming renewals
          </h2>
          <Button variant="outline" size="sm">
            View calendar
          </Button>
        </div>
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
                  <Badge variant="warning">Due {renewal.nextRenewal}</Badge>
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
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Active subscriptions
          </h2>
          <Button size="sm">Add subscription</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {mockSubscriptions.map((subscription) => {
            const service = servicesById[subscription.serviceId];
            return (
              <Card key={subscription.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{service?.name}</CardTitle>
                    <p className="text-sm text-slate-500">{subscription.planName}</p>
                  </div>
                  <Badge variant={subscription.autoImportSource === 'oauth' ? 'success' : 'default'}>
                    {subscription.autoImportSource === 'oauth' ? 'Auto' : 'Manual'}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">
                      ${subscription.billingAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">/{subscription.billingInterval}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
