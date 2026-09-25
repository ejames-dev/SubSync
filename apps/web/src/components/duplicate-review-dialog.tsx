'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type {
  DashboardDuplicateGroup,
  ServiceProvider,
  Subscription,
} from '@subscription-tracker/types';
import { X } from 'lucide-react';
import {
  dismissDuplicateSubscriptions,
  mergeDuplicateSubscriptions,
} from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

type Props = {
  groups: DashboardDuplicateGroup[];
  subscriptions: Subscription[];
  servicesById: Record<string, ServiceProvider>;
  onClose: () => void;
  onResolved: () => Promise<void>;
};

export function DuplicateReviewDialog({
  groups,
  subscriptions,
  servicesById,
  onClose,
  onResolved,
}: Props) {
  const [keepByService, setKeepByService] = useState<Record<string, string>>(
    {}
  );
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const subscriptionsById = Object.fromEntries(
    subscriptions.map((subscription) => [subscription.id, subscription])
  );

  async function runAction(serviceId: string, action: () => Promise<unknown>) {
    setPendingServiceId(serviceId);
    setError(null);
    try {
      await action();
      await onResolved();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Failed to update duplicates.'
      );
    } finally {
      setPendingServiceId(null);
    }
  }

  function handleMerge(group: DashboardDuplicateGroup) {
    const keepId = keepByService[group.serviceId] ?? group.subscriptionIds[0];
    const removeIds = group.subscriptionIds.filter((id) => id !== keepId);
    void runAction(group.serviceId, () =>
      mergeDuplicateSubscriptions({ keepId, removeIds })
    );
  }

  function handleDismiss(group: DashboardDuplicateGroup) {
    void runAction(group.serviceId, () =>
      dismissDuplicateSubscriptions(group.serviceId)
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-review-title"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="duplicate-review-title"
              className="text-lg font-semibold text-slate-900"
            >
              Review duplicates
            </h2>
            <p className="text-sm text-slate-500">
              Pick the entry to keep and merge the rest into it, or mark the
              group as not duplicates.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close duplicate review"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            All duplicates are resolved.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => {
              const keepId =
                keepByService[group.serviceId] ?? group.subscriptionIds[0];
              const busy = pendingServiceId === group.serviceId;
              const logoUrl = servicesById[group.serviceId]?.logoUrl;

              return (
                <section
                  key={group.serviceId}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full border border-slate-200 object-cover"
                      />
                    ) : null}
                    <h3 className="font-medium text-slate-900">
                      {group.serviceName}
                    </h3>
                    <Badge variant="warning">{group.count} entries</Badge>
                  </div>
                  <fieldset className="space-y-2" disabled={busy}>
                    <legend className="sr-only">
                      Subscription to keep for {group.serviceName}
                    </legend>
                    {group.subscriptionIds.map((id) => {
                      const subscription = subscriptionsById[id];
                      if (!subscription) {
                        return null;
                      }
                      return (
                        <label
                          key={id}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${keepId === id ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="radio"
                              name={`keep-${group.serviceId}`}
                              value={id}
                              checked={keepId === id}
                              onChange={() =>
                                setKeepByService((current) => ({
                                  ...current,
                                  [group.serviceId]: id,
                                }))
                              }
                            />
                            <span>
                              <span className="block font-medium text-slate-900">
                                {subscription.planName}
                              </span>
                              <span className="block text-slate-500">
                                {formatCurrency(
                                  subscription.billingAmount,
                                  subscription.billingCurrency
                                )}{' '}
                                {subscription.billingInterval} · renews{' '}
                                {subscription.nextRenewal.slice(0, 10)}
                              </span>
                            </span>
                          </span>
                          <span className="text-xs text-slate-500">
                            {subscription.autoImportSource ?? 'manual'}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleDismiss(group)}
                    >
                      Not duplicates
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => handleMerge(group)}
                    >
                      {busy ? 'Saving...' : 'Merge into selected'}
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
