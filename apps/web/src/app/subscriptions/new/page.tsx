import { getServices } from '../../../lib/api';
import { SubscriptionForm } from '../../../components/subscription-form';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export const dynamic = 'force-dynamic';

export default async function NewSubscriptionPage() {
  const services = await getServices();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add subscription</CardTitle>
          <p className="text-sm text-slate-500">
            Persisted directly to Postgres via the Nest API.
          </p>
        </CardHeader>
        <CardContent>
          <SubscriptionForm services={services} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
