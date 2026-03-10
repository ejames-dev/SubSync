import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { CheckCircle2, PlugZap } from 'lucide-react';

const integrations = [
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'OAuth-based connection for Premium plans.',
    status: 'connected',
    lastSynced: '5 min ago',
  },
  {
    id: 'google',
    name: 'Google / YouTube Premium',
    description: 'Use Google OAuth to import YouTube Premium & Music.',
    status: 'ready',
  },
  {
    id: 'netflix',
    name: 'Netflix via email receipts',
    description: 'Forward billing emails to auto-detect renewals.',
    status: 'manual',
  },
];

export default function ConnectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Connections</h1>
        <p className="text-sm text-slate-500">
          Hook up streaming providers for real-time subscription syncing.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{integration.name}</CardTitle>
                {integration.status === 'connected' ? (
                  <Badge variant="success">Connected</Badge>
                ) : integration.status === 'manual' ? (
                  <Badge variant="warning">Email route</Badge>
                ) : (
                  <Badge>Ready</Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">{integration.description}</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {integration.status === 'connected' ? (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Synced {integration.lastSynced}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {integration.status === 'manual'
                    ? 'Forward receipts to subs+you@track.app'
                    : 'Secure OAuth hand-off'}
                </p>
              )}
              <Button variant={integration.status === 'connected' ? 'outline' : 'default'}>
                {integration.status === 'connected' ? 'Manage' : 'Connect'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-dashed border-slate-300">
        <CardHeader className="flex flex-row items-center gap-3">
          <PlugZap className="h-10 w-10 text-slate-400" />
          <div>
            <CardTitle>Email forwarding alias</CardTitle>
            <p className="text-sm text-slate-500">
              Send streaming invoices to <span className="font-mono text-slate-800">subs+general@beacon.app</span>
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Copy alias</Button>
        </CardContent>
      </Card>
    </div>
  );
}
