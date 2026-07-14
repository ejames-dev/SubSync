'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  BillingInterval,
  EmailReceipt,
  EmailReceiptItem,
  ServiceProvider,
} from '@subscription-tracker/types';
import {
  approveEmailReceiptItem,
  listEmailReceipts,
  listServices,
  rejectEmailReceiptItem,
} from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type ItemDraft = Pick<
  EmailReceiptItem,
  | 'serviceId'
  | 'providerName'
  | 'planName'
  | 'billingAmount'
  | 'billingCurrency'
  | 'billingInterval'
  | 'nextRenewal'
>;

/* The base ESLint rule mistakes parameter names in TypeScript function types for variables. */
/* eslint-disable no-unused-vars */
type DraftChangeHandler = <K extends keyof ItemDraft>(
  item: EmailReceiptItem,
  field: K,
  value: ItemDraft[K],
) => void;
type ReceiptItemActionHandler = (
  receipt: EmailReceipt,
  item: EmailReceiptItem,
) => Promise<void>;
/* eslint-enable no-unused-vars */

const billingIntervals: BillingInterval[] = [
  'monthly',
  'quarterly',
  'yearly',
  'custom',
];

function createDraft(item: EmailReceiptItem): ItemDraft {
  return {
    serviceId: item.serviceId,
    providerName: item.providerName,
    planName: item.planName,
    billingAmount: item.billingAmount,
    billingCurrency: item.billingCurrency,
    billingInterval: item.billingInterval,
    nextRenewal: item.nextRenewal.slice(0, 10),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function confidenceLabel(confidence: number) {
  const percentage = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(percentage)}% confidence`;
}

export function ImportReviewClient() {
  const [receipts, setReceipts] = useState<EmailReceipt[]>([]);
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadReviewQueue = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const [nextReceipts, nextServices] = await Promise.all([
        listEmailReceipts('review'),
        listServices(),
      ]);
      setReceipts(nextReceipts);
      setServices(nextServices);
      setDrafts(
        Object.fromEntries(
          nextReceipts.flatMap((receipt) =>
            receipt.items
              .filter((item) => item.action === 'review')
              .map((item) => [item.id, createDraft(item)]),
          ),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'The import review queue could not be loaded.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReviewQueue();
  }, [loadReviewQueue]);

  function updateDraft<K extends keyof ItemDraft>(
    item: EmailReceiptItem,
    field: K,
    value: ItemDraft[K],
  ) {
    setDrafts((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? createDraft(item)),
        [field]: value,
      },
    }));
  }

  async function handleApprove(receipt: EmailReceipt, item: EmailReceiptItem) {
    const draft = drafts[item.id] ?? createDraft(item);
    if (!draft.serviceId) {
      setError('Choose a service before approving this import.');
      return;
    }
    if (!Number.isFinite(draft.billingAmount) || draft.billingAmount < 0) {
      setError('Enter a valid billing amount before approving this import.');
      return;
    }
    if (!draft.planName.trim()) {
      setError('Enter a plan name before approving this import.');
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(draft.billingCurrency.trim())) {
      setError('Enter a three-letter billing currency before approving.');
      return;
    }
    if (!draft.nextRenewal) {
      setError('Choose a renewal date before approving this import.');
      return;
    }

    setPendingItemId(item.id);
    setError(null);
    setMessage(null);
    try {
      await approveEmailReceiptItem(receipt.id, item.id, {
        serviceId: draft.serviceId,
        planName: draft.planName,
        billingAmount: draft.billingAmount,
        billingCurrency: draft.billingCurrency.trim().toUpperCase(),
        billingInterval: draft.billingInterval,
        nextRenewal: draft.nextRenewal,
      });
      removeReviewedItem(receipt.id, item.id);
      setMessage(`${draft.providerName} was approved and applied.`);
      await loadReviewQueue(true);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Approval failed.',
      );
    } finally {
      setPendingItemId(null);
    }
  }

  async function handleReject(receipt: EmailReceipt, item: EmailReceiptItem) {
    if (!window.confirm(`Reject the parsed ${item.providerName} item?`)) {
      return;
    }
    setPendingItemId(item.id);
    setError(null);
    setMessage(null);
    try {
      await rejectEmailReceiptItem(receipt.id, item.id);
      removeReviewedItem(receipt.id, item.id);
      setMessage(`${item.providerName} was rejected.`);
      await loadReviewQueue(true);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Rejection failed.',
      );
    } finally {
      setPendingItemId(null);
    }
  }

  function removeReviewedItem(receiptId: string, itemId: string) {
    setReceipts((current) =>
      current.flatMap((receipt) => {
        if (receipt.id !== receiptId) return [receipt];
        const items = receipt.items.filter((item) => item.id !== itemId);
        return items.some((item) => item.action === 'review')
          ? [{ ...receipt, items }]
          : [];
      }),
    );
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-500">Loading import review queue...</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Import review
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Check email receipt details that SubSync could not identify with
            enough confidence to apply automatically.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={refreshing || pendingItemId !== null}
          onClick={() => void loadReviewQueue(true)}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {message}
        </div>
      ) : null}

      {receipts.length === 0 && !error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="font-medium text-slate-900">Nothing needs review</p>
            <p className="mt-1 text-sm text-slate-500">
              Low-confidence receipt imports will appear here after an email
              sync.
            </p>
          </CardContent>
        </Card>
      ) : (
        receipts.map((receipt) => (
          <ReceiptReviewCard
            key={receipt.id}
            receipt={receipt}
            services={services}
            drafts={drafts}
            pendingItemId={pendingItemId}
            onDraftChange={updateDraft}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))
      )}
    </div>
  );
}

function ReceiptReviewCard({
  receipt,
  services,
  drafts,
  pendingItemId,
  onDraftChange,
  onApprove,
  onReject,
}: {
  receipt: EmailReceipt;
  services: ServiceProvider[];
  drafts: Record<string, ItemDraft>;
  pendingItemId: string | null;
  onDraftChange: DraftChangeHandler;
  onApprove: ReceiptItemActionHandler;
  onReject: ReceiptItemActionHandler;
}) {
  const reviewItems = receipt.items.filter((item) => item.action === 'review');

  return (
    <Card className="p-0">
      <CardHeader className="mb-0 border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{receipt.subject}</CardTitle>
            <p className="mt-1 break-all text-sm text-slate-500">
              From {receipt.sender}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {formatDate(receipt.receivedAt)} ·{' '}
              {receipt.source === 'gmail' ? 'Gmail sync' : 'Manual import'}
              {receipt.parserId
                ? ` · ${receipt.parserId} v${receipt.parserVersion ?? 1}`
                : ''}
            </p>
          </div>
          <Badge variant="warning">{confidenceLabel(receipt.confidence)}</Badge>
        </div>
        {receipt.bodySnapshot ? (
          <details className="mt-4 rounded-md bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Sanitized email excerpt
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs text-slate-600">
              {receipt.bodySnapshot}
            </pre>
          </details>
        ) : null}
      </CardHeader>
      <CardContent className="divide-y divide-slate-200 p-0">
        {reviewItems.map((item) => (
          <ReceiptItemEditor
            key={item.id}
            item={item}
            draft={drafts[item.id] ?? createDraft(item)}
            services={services}
            busy={pendingItemId === item.id}
            actionsDisabled={pendingItemId !== null}
            onChange={onDraftChange}
            onApprove={() => onApprove(receipt, item)}
            onReject={() => onReject(receipt, item)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ReceiptItemEditor({
  item,
  draft,
  services,
  busy,
  actionsDisabled,
  onChange,
  onApprove,
  onReject,
}: {
  item: EmailReceiptItem;
  draft: ItemDraft;
  services: ServiceProvider[];
  busy: boolean;
  actionsDisabled: boolean;
  onChange: DraftChangeHandler;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{item.providerName}</p>
          <p className="text-xs text-slate-500">{item.planName}</p>
        </div>
        <Badge variant="warning">{confidenceLabel(item.confidence)}</Badge>
      </div>

      {item.evidence.length > 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Parser evidence
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {item.evidence.map((evidence, index) => (
              <li key={`${item.id}-evidence-${index}`} className="break-words">
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Service
          <select
            className={inputClass}
            value={draft.serviceId ?? ''}
            onChange={(event) => {
              const service = services.find(
                ({ id }) => id === event.target.value,
              );
              onChange(item, 'serviceId', event.target.value || undefined);
              if (service) onChange(item, 'providerName', service.name);
            }}
          >
            <option value="">Choose a service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Plan
          <input
            className={inputClass}
            value={draft.planName}
            onChange={(event) => onChange(item, 'planName', event.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Amount
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={draft.billingAmount}
            onChange={(event) =>
              onChange(item, 'billingAmount', event.target.valueAsNumber)
            }
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Currency
          <input
            className={inputClass}
            maxLength={3}
            value={draft.billingCurrency}
            onChange={(event) =>
              onChange(item, 'billingCurrency', event.target.value)
            }
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Billing interval
          <select
            className={inputClass}
            value={draft.billingInterval}
            onChange={(event) =>
              onChange(
                item,
                'billingInterval',
                event.target.value as BillingInterval,
              )
            }
          >
            {billingIntervals.map((interval) => (
              <option key={interval} value={interval}>
                {interval[0].toUpperCase() + interval.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Renewal date
          <input
            type="date"
            className={inputClass}
            value={draft.nextRenewal}
            onChange={(event) =>
              onChange(item, 'nextRenewal', event.target.value)
            }
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button disabled={actionsDisabled} onClick={() => void onApprove()}>
          {busy ? 'Applying...' : 'Approve and apply'}
        </Button>
        <Button
          variant="outline"
          disabled={actionsDisabled}
          onClick={() => void onReject()}
        >
          {busy ? 'Working...' : 'Reject'}
        </Button>
      </div>
    </div>
  );
}
