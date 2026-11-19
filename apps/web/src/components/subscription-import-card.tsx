'use client';

import { useState, type ChangeEvent } from 'react';
import type {
  SubscriptionImportColumnMap,
  SubscriptionImportResult,
} from '@subscription-tracker/types';
import { importSubscriptionsFile } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function SubscriptionImportCard() {
  const [showMapper, setShowMapper] = useState(false);
  const [columnMap, setColumnMap] = useState<SubscriptionImportColumnMap>({
    serviceName: '',
    planName: '',
    billingAmount: '',
    billingCurrency: '',
    billingInterval: '',
    nextRenewal: '',
  });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SubscriptionImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await importSubscriptionsFile(
        file,
        showMapper ? columnMap : undefined,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Import subscriptions (CSV or JSON)</CardTitle>
            <p className="text-sm text-slate-500">
              Migrate from a SubSync export, spreadsheet, or another subscription
              tracker. Unknown services are created automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowMapper((prev) => !prev)}
          >
            {showMapper ? 'Hide column mapper' : 'Custom CSV columns'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showMapper ? (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
            {(
              [
                ['serviceName', 'Service column header'],
                ['planName', 'Plan column header'],
                ['billingAmount', 'Amount column header'],
                ['billingCurrency', 'Currency column header'],
                ['billingInterval', 'Interval column header'],
                ['nextRenewal', 'Next renewal column header'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block text-xs font-medium text-slate-700">
                {label}
                <input
                  type="text"
                  placeholder={`Auto (${field})`}
                  value={columnMap[field] ?? ''}
                  onChange={(e) =>
                    setColumnMap((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </label>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              disabled={importing}
              onChange={(e) => void handleFileChange(e)}
            />
            <Button variant="outline" disabled={importing} asChild>
              <span>
                {importing ? 'Importing...' : 'Choose CSV or JSON file'}
              </span>
            </Button>
          </label>
        </div>

        {result ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium">
              Import finished: {result.created} created, {result.updated}{' '}
              updated, {result.skipped} skipped.
            </p>
            {result.errors.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
                {result.errors.slice(0, 5).map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
