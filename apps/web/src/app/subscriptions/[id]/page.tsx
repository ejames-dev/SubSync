import { notFound } from 'next/navigation';
import { getServices, getSubscription, getSubscriptionEvents } from '../../../lib/api';
import { SubscriptionForm } from '../../../components/subscription-form';
import { SubscriptionTimeline } from '../../../components/subscription-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function SubscriptionDetailPage({ params }: Props) {
  try {
    const [subscription, services, events] = await Promise.all([
      getSubscription(params.id),
      getServices(),
      getSubscriptionEvents(params.id),
    ]);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{subscription.planName}</CardTitle>
            <p className="text-sm text-slate-500">Manage subscription details</p>
          </CardHeader>
          <CardContent>
            <SubscriptionForm
              services={services}
              mode="edit"
              initial={subscription}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status timeline</CardTitle>
            <p className="text-sm text-slate-500">Track key changes over time</p>
          </CardHeader>
          <CardContent>
            <SubscriptionTimeline events={events} />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    notFound();
  }
}
