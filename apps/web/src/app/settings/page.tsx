import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export default function SettingsPage() {
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
          <form className="flex flex-col gap-4">
            <label className="text-sm font-medium text-slate-700">
              Days before renewal
              <input
                type="number"
                defaultValue={7}
                className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" defaultChecked /> Email
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" defaultChecked /> Push
              </label>
            </div>
            <Button className="w-fit">Save preferences</Button>
          </form>
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
