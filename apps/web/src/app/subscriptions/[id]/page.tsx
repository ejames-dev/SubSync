import { notFound } from 'next/navigation';
import { getServices, getSubscription } from '../../../lib/api';
import { SubscriptionForm } from '../../../components/subscription-form';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function SubscriptionDetailPage({ params }: Props) {
  try {
    const [subscription, services] = await Promise.all([
      getSubscription(params.id),
      getServices(),
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
      </div>
    );
  } catch (error) {
    notFound();
  }
}
