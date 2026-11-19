'use client';

import {
  SERVICE_CATEGORIES,
  ServiceCategory,
  ServiceProvider,
  Subscription,
} from '@subscription-tracker/types';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import {
  createCustomService,
  createSubscription,
  deleteSubscription,
  updateSubscription,
} from '../lib/api';
import { isSafeExternalUrl } from '../lib/utils';

interface Props {
  services: ServiceProvider[];
  mode: 'create' | 'edit';
  initial?: Subscription;
}

export function SubscriptionForm({ services, mode, initial }: Props) {
  const router = useRouter();
  const [availableServices, setAvailableServices] =
    useState<ServiceProvider[]>(services);
  const [selectedServiceId, setSelectedServiceId] = useState(
    initial?.serviceId ?? '',
  );
  const [selectedInterval, setSelectedInterval] = useState<
    Subscription['billingInterval']
  >(initial?.billingInterval ?? 'monthly');
  const [selectedStatus, setSelectedStatus] = useState<Subscription['status']>(
    initial?.status ?? 'active',
  );
  const [showCustomCreator, setShowCustomCreator] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<ServiceCategory>('saas');
  const [customCancelUrl, setCustomCancelUrl] = useState('');
  const [creatingService, setCreatingService] = useState(false);

  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const selectedService = availableServices.find(
    (service) => service.id === selectedServiceId,
  );

  const handleCreateCustomService = async () => {
    if (!customName.trim()) {
      setError('Enter a custom service name.');
      return;
    }
    setCreatingService(true);
    setError(null);
    try {
      const created = await createCustomService({
        name: customName.trim(),
        category: customCategory,
        cancelUrl: customCancelUrl.trim() || undefined,
      });
      setAvailableServices((current) => [...current, created]);
      setSelectedServiceId(created.id);
      setCustomName('');
      setCustomCancelUrl('');
      setShowCustomCreator(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create custom service',
      );
    } finally {
      setCreatingService(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    const formData = new FormData(event.currentTarget);
    const rawCustomDays = formData.get('customIntervalDays') as string | null;
    const rawTrialEnds = formData.get('trialEndsAt') as string | null;
    const rawPostTrialAmount = formData.get('postTrialAmount') as string | null;
    const rawLeadOverride = formData.get('leadTimeDaysOverride') as
      | string
      | null;
    const rawTags = (formData.get('tags') as string | null) ?? '';
    const tags = rawTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const rawTotalSeats = formData.get('totalSeats') as string | null;
    const rawSharedSeats = formData.get('sharedSeats') as string | null;
    const rawPersonalShare = formData.get('personalShare') as string | null;
    const rawBundleParent = formData.get('bundleParentId') as string | null;

    const payload = {
      serviceId: selectedServiceId || (formData.get('serviceId') as string),
      planName: formData.get('planName') as string,
      billingAmount: Number(formData.get('billingAmount')),
      billingCurrency: (formData.get('billingCurrency') as string)
        .trim()
        .toUpperCase(),
      billingInterval: selectedInterval,
      customIntervalDays:
        selectedInterval === 'custom' && rawCustomDays
          ? Number(rawCustomDays)
          : null,
      nextRenewal: `${formData.get('nextRenewal') as string}T00:00:00.000Z`,
      trialEndsAt:
        selectedStatus === 'trial' && rawTrialEnds
          ? `${rawTrialEnds}T00:00:00.000Z`
          : null,
      postTrialAmount:
        selectedStatus === 'trial' && rawPostTrialAmount
          ? Number(rawPostTrialAmount)
          : null,
      leadTimeDaysOverride:
        rawLeadOverride !== null && rawLeadOverride.trim() !== ''
          ? Number(rawLeadOverride)
          : null,
      tags,
      totalSeats:
        rawTotalSeats !== null && rawTotalSeats.trim() !== ''
          ? Number(rawTotalSeats)
          : null,
      sharedSeats:
        rawSharedSeats !== null && rawSharedSeats.trim() !== ''
          ? Number(rawSharedSeats)
          : null,
      personalShare:
        rawPersonalShare !== null && rawPersonalShare.trim() !== ''
          ? Number(rawPersonalShare)
          : null,
      bundleParentId: rawBundleParent?.trim() ? rawBundleParent.trim() : null,
      paymentSource:
        (formData.get('paymentSource') as Subscription['paymentSource']) ||
        undefined,
      paymentLast4: (formData.get('paymentLast4') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
      status: selectedStatus,
    };

    try {
      if (mode === 'edit' && initial) {
        await updateSubscription(initial.id, payload);
      } else {
        await createSubscription(payload);
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
      await deleteSubscription(initial.id);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const dateValue = initial
    ? new Date(initial.nextRenewal).toISOString().split('T')[0]
    : undefined;
  const trialDateValue = initial?.trialEndsAt
    ? new Date(initial.trialEndsAt).toISOString().split('T')[0]
    : undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Service</label>
          <button
            type="button"
            onClick={() => setShowCustomCreator((prev) => !prev)}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {showCustomCreator
              ? 'Cancel custom service'
              : '+ New custom service'}
          </button>
        </div>
        <select
          name="serviceId"
          required
          value={selectedServiceId}
          onChange={(event) => setSelectedServiceId(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Choose a service</option>
          {availableServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
              {service.isCustom ? ' (Custom)' : ''}
            </option>
          ))}
        </select>

        {showCustomCreator && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Create custom provider
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                placeholder="Service name (e.g. ChatGPT Plus)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={customCategory}
                onChange={(e) =>
                  setCustomCategory(e.target.value as ServiceCategory)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category[0].toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <input
              placeholder="Cancellation URL (optional https://...)"
              value={customCancelUrl}
              onChange={(e) => setCustomCancelUrl(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={creatingService}
              onClick={() => void handleCreateCustomService()}
            >
              {creatingService ? 'Creating…' : 'Add service to catalog'}
            </Button>
          </div>
        )}
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
            maxLength={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Interval</label>
          <select
            name="billingInterval"
            required
            value={selectedInterval}
            onChange={(e) =>
              setSelectedInterval(
                e.target.value as Subscription['billingInterval'],
              )
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {selectedInterval === 'custom' && (
        <div>
          <label className="text-sm font-medium text-slate-700">
            Custom billing period (days)
          </label>
          <input
            name="customIntervalDays"
            type="number"
            min="1"
            max="3650"
            placeholder="e.g. 14 for biweekly or 730 for 2-year"
            defaultValue={initial?.customIntervalDays ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">
            Next renewal
          </label>
          <input
            name="nextRenewal"
            type="date"
            required
            defaultValue={dateValue}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Reminder lead time override (days, optional)
          </label>
          <input
            name="leadTimeDaysOverride"
            type="number"
            min="0"
            max="365"
            placeholder="Uses global Settings default"
            defaultValue={initial?.leadTimeDaysOverride ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">
            Payment source
          </label>
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
          value={selectedStatus}
          onChange={(e) =>
            setSelectedStatus(e.target.value as Subscription['status'])
          }
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="paused">Paused</option>
          <option value="flagged_for_cancellation">
            Flagged for cancellation
          </option>
          <option value="canceled_pending">Cancels on next renewal</option>
          <option value="canceled">Canceled (archived)</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Paused and archived canceled subscriptions stay in your history
          without counting toward active monthly spend.
        </p>
      </div>

      {selectedStatus === 'trial' && (
        <div className="grid gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-800">
              Trial ends on
            </label>
            <input
              name="trialEndsAt"
              type="date"
              defaultValue={trialDateValue ?? dateValue}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-800">
              Post-trial renewal amount
            </label>
            <input
              name="postTrialAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 19.99"
              defaultValue={initial?.postTrialAmount ?? ''}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-slate-700">
          Tags (comma-separated)
        </label>
        <input
          name="tags"
          placeholder="work, ai, family"
          defaultValue={initial?.tags?.join(', ') ?? ''}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-medium text-slate-800">
            Household splitting &amp; bundle link (optional)
          </p>
          <p className="text-xs text-slate-500">
            Track shared family plans so dashboard totals reflect your personal
            share while keeping gross card charges accurate.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-slate-700">
              Total seats
            </label>
            <input
              name="totalSeats"
              type="number"
              min="1"
              max="100"
              placeholder="e.g. 6"
              defaultValue={initial?.totalSeats ?? ''}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">
              Shared seats reimbursed
            </label>
            <input
              name="sharedSeats"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 4"
              defaultValue={initial?.sharedSeats ?? ''}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">
              Personal share override
            </label>
            <input
              name="personalShare"
              type="number"
              step="0.01"
              min="0"
              placeholder="Auto from seats"
              defaultValue={initial?.personalShare ?? ''}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">
              Bundle parent ID
            </label>
            <input
              name="bundleParentId"
              type="text"
              placeholder="Parent subscription ID"
              defaultValue={initial?.bundleParentId ?? ''}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {selectedService?.cancelUrl &&
        isSafeExternalUrl(selectedService.cancelUrl) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-950">
              Ready to cancel?
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Open the provider&apos;s official cancellation instructions, then
              update this subscription when the provider confirms the
              cancellation.
            </p>
            <a
              href={selectedService.cancelUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium text-amber-950 underline underline-offset-2"
            >
              Open cancellation guide ↗
            </a>
          </div>
        )}

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
