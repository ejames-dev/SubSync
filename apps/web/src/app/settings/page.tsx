import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  getNotificationPreference,
} from '../../lib/api';
import { NotificationPreferenceForm } from '../../components/notification-preference-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const preference = await getNotificationPreference();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Alerts, notification windows, and account tools.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reminder lead time</CardTitle>
          <p className="text-sm text-slate-500">
            Control how far ahead Beacon pings you for renewals.
          </p>
        </CardHeader>
        <CardContent>
          <NotificationPreferenceForm preference={preference} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email forwarding</CardTitle>
          <p className="text-sm text-slate-500">
            Unique alias for capturing Netflix, Disney+, and Hulu invoices.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <code className="block rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
            subs+general@beacon.app
          </code>
          <Button variant="outline">Copy alias</Button>
        </CardContent>
      </Card>
    </div>
  );
}
