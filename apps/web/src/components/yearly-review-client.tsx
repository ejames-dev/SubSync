'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { YearlyReview } from '@subscription-tracker/types';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  Search,
} from 'lucide-react';
import { getYearlyReview } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const currentYear = new Date().getFullYear();
const availableYears = Array.from(
  { length: 6 },
  (_, index) => currentYear - index
);

export function YearlyReviewClient() {
  const [year, setYear] = useState(currentYear);
  const [review, setReview] = useState<YearlyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void getYearlyReview(year)
      .then(setReview)
      .catch((loadError: unknown) => {
        setReview(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to build the yearly review.'
        );
      })
      .finally(() => setLoading(false));
  }, [year]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Money awareness</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Your subscriptions in {year}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            A review of estimated renewal spend, recorded price increases, and
            subscriptions whose tracking data deserves another look.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Review year
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {availableYears.map((availableYear) => (
              <option key={availableYear} value={availableYear}>
                {availableYear}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent>Building your {year} review...</CardContent>
        </Card>
      ) : review ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {review.spendByCurrency.length > 0 ? (
              review.spendByCurrency.map((total) => (
                <Card key={total.currency}>
                  <CardHeader>
                    <CardTitle>Estimated {total.currency} spend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-slate-900">
                      {formatCurrency(total.amount, total.currency)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {total.renewalCount} tracked renewal
                      {total.renewalCount === 1 ? '' : 's'} across{' '}
                      {total.subscriptionCount} subscription
                      {total.subscriptionCount === 1 ? '' : 's'}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Estimated spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-slate-900">—</p>
                  <p className="mt-1 text-xs text-slate-500">
                    No tracked renewals fall in this review period.
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Recorded increases</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900">
                  {review.biggestPriceIncreases.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Price increases captured during {year}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Needs a look</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900">
                  {review.reviewSignals.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Low-confidence tracking signals, not usage claims
                </p>
              </CardContent>
            </Card>
          </section>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex gap-3 text-blue-950">
              <CalendarRange className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">This review is an estimate</p>
                <p className="mt-1 text-sm text-blue-900">
                  {review.methodology}
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  Review period: {formatDate(review.periodStart)} through{' '}
                  {formatDate(review.periodEnd)}. Currency totals stay separate.
                </p>
              </div>
            </CardContent>
          </Card>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-rose-600" />
              <h3 className="text-lg font-semibold text-slate-900">
                Biggest price increases by percentage
              </h3>
            </div>
            {review.biggestPriceIncreases.length === 0 ? (
              <Card>
                <CardContent>
                  No price increases were recorded in {year}.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {review.biggestPriceIncreases.map((increase) => (
                  <Card
                    key={`${increase.subscriptionId}-${increase.occurredAt}`}
                  >
                    <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Link
                          href={`/subscriptions/${increase.subscriptionId}`}
                          className="font-medium text-slate-900 hover:text-blue-700"
                        >
                          {increase.serviceName} · {increase.planName}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(increase.occurredAt)} ·{' '}
                          {increase.dataSource === 'structured'
                            ? 'Recorded amount data'
                            : 'Recovered from a legacy event note'}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-semibold text-rose-700">
                          +
                          {formatCurrency(
                            increase.increaseAmount,
                            increase.currency
                          )}
                          {increase.increasePercent !== undefined
                            ? ` (${increase.increasePercent}%)`
                            : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatCurrency(
                            increase.previousAmount,
                            increase.currency
                          )}{' '}
                          to{' '}
                          {formatCurrency(
                            increase.newAmount,
                            increase.currency
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-slate-900">
                Subscriptions to review
              </h3>
            </div>
            {review.reviewSignals.length === 0 ? (
              <Card>
                <CardContent>
                  No stale or overdue tracking signals found.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {review.reviewSignals.map((signal) => (
                  <Card key={signal.subscriptionId}>
                    <CardContent>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/subscriptions/${signal.subscriptionId}`}
                            className="font-medium text-slate-900 hover:text-blue-700"
                          >
                            {signal.serviceName} · {signal.planName}
                          </Link>
                          <p className="mt-2 text-sm text-slate-600">
                            {signal.detail}
                          </p>
                        </div>
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge variant="warning">Low confidence</Badge>
                        <span>Renewal: {formatDate(signal.nextRenewal)}</span>
                        {signal.lastActivityAt ? (
                          <span>
                            Last tracked: {formatDate(signal.lastActivityAt)}
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
