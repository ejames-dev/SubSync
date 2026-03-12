import { getServices } from '../../lib/api';

export const dynamic = 'force-dynamic';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { PlugZap } from 'lucide-react';

const alias = 'subs+general@beacon.app';

export default async function ConnectPage() {
  const services = await getServices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Connections</h1>
        <p className="text-sm text-slate-500">
          Hook up streaming providers for real-time subscription syncing.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{integration.name}</CardTitle>
                {integration.supportsOAuth ? (
                  <Badge>Ready</Badge>
                ) : (
                  <Badge variant="warning">Email route</Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">Category: {integration.category}</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {integration.supportsOAuth
                  ? 'Connect via OAuth to keep plans current.'
                  : 'Route invoices to the forwarding alias below.'}
              </p>
              <Button variant={integration.supportsOAuth ? 'default' : 'outline'}>
                {integration.supportsOAuth ? 'Connect' : 'Guide'}
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
              Send streaming invoices to <span className="font-mono text-slate-800">{alias}</span>
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
