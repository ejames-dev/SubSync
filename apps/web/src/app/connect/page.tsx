import { Suspense } from 'react';
import { ConnectClient } from '../../components/connect-client';

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading connections...</div>}>
      <ConnectClient />
    </Suspense>
  );
}
