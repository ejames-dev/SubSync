'use client';

import { ServiceProvider, Subscription } from '@subscription-tracker/types';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Props {
  services: ServiceProvider[];
  mode: 'create' | 'edit';
  initial?: Subscription;
}

export function SubscriptionForm({ services, mode, initial }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);

  if (!API_BASE) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-red-600">
          NEXT_PUBLIC_API_URL is not configured.
        </CardContent>
      </Card>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      serviceId: formData.get('serviceId'),
      planName: formData.get('planName'),
      billingAmount: Number(formData.get('billingAmount')),
      billingCurrency: formData.get('billingCurrency'),
      billingInterval: formData.get('billingInterval'),
      nextRenewal: formData.get('nextRenewal'),
      paymentSource: formData.get('paymentSource') || undefined,
      paymentLast4: formData.get('paymentLast4') || undefined,
      notes: formData.get('notes') || undefined,
      status: formData.get('status') || undefined,
    };

    const url =
      mode === 'edit' && initial
        ? `${API_BASE}/subscriptions/${initial.id}`
        : `${API_BASE}/subscriptions`;

    try {
      const response = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setStatus('success');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm('Delete this subscription?')) return;

    try {
      const response = await fetch(`${API_BASE}/subscriptions/${initial.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const dateValue = initial
    ? new Date(initial.nextRenewal).toISOString().split('T')[0]
    : undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">Service</label>
        <select
          name="serviceId"
          required
          defaultValue={initial?.serviceId ?? ''}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Choose a service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Plan name</label>
        <input
          name="planName"
          required
          defaultValue={initial?.planName}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Amount</label>
          <input
            name="billingAmount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={initial?.billingAmount ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Currency</label>
          <input
            name="billingCurrency"
            defaultValue={initial?.billingCurrency ?? 'USD'}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Interval</label>
          <select
            name="billingInterval"
            required
            defaultValue={initial?.billingInterval ?? 'monthly'}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="quarterly">Quarterly</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Next renewal</label>
        <input
          name="nextRenewal"
          type="date"
          required
          defaultValue={dateValue}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Payment source</label>
          <select
            name="paymentSource"
            defaultValue={initial?.paymentSource ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            <option value="card">Card</option>
            <option value="paypal">PayPal</option>
            <option value="gift">Gift</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Last 4</label>
          <input
            name="paymentLast4"
            maxLength={4}
            defaultValue={initial?.paymentLast4 ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Status</label>
        <select
          name="status"
          defaultValue={initial?.status ?? 'active'}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="canceled_pending">Cancels on next renewal</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ''}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting'
            ? 'Saving…'
            : mode === 'edit'
            ? 'Save changes'
            : 'Save subscription'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        {mode === 'edit' && initial && (
          <Button type="button" variant="outline" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
