import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  projectMonthOccurrences,
  toMonthlyEquivalentClient,
} from './calendar.ts';
import { formatCurrency, isRenewalSnoozed, isSafeExternalUrl } from './utils.ts';

describe('web calendar and utility helpers', () => {
  it('computes monthly equivalents across weekly, monthly, quarterly, yearly, and custom cadences', () => {
    assert.equal(Math.round(toMonthlyEquivalentClient(10, 'weekly') * 100) / 100, 43.33);
    assert.equal(toMonthlyEquivalentClient(15, 'monthly'), 15);
    assert.equal(toMonthlyEquivalentClient(30, 'quarterly'), 10);
    assert.equal(toMonthlyEquivalentClient(120, 'yearly'), 10);
    assert.equal(
      Math.round(toMonthlyEquivalentClient(14, 'custom', 14) * 100) / 100,
      30.42,
    );
  });

  it('projects monthly occurrences including weekly repeats and trial conversions while skipping paused/canceled', () => {
    const servicesById = {
      svc_spotify: {
        id: 'svc_spotify',
        name: 'Spotify',
        category: 'music' as const,
        supportsOAuth: true,
      },
      svc_linear: {
        id: 'svc_linear',
        name: 'Linear',
        category: 'saas' as const,
        supportsOAuth: false,
      },
    };

    const occurrences = projectMonthOccurrences(
      [
        {
          id: 'sub_weekly',
          serviceId: 'svc_spotify',
          planName: 'Weekly Pass',
          status: 'active',
          billingAmount: 4.99,
          billingCurrency: 'USD',
          billingInterval: 'weekly',
          nextRenewal: '2026-11-04T00:00:00.000Z',
          statusChangedAt: '2026-11-01T00:00:00.000Z',
        },
        {
          id: 'sub_trial',
          serviceId: 'svc_linear',
          planName: 'Pro Trial',
          status: 'trial',
          billingAmount: 0,
          postTrialAmount: 16,
          billingCurrency: 'USD',
          billingInterval: 'monthly',
          nextRenewal: '2026-11-20T00:00:00.000Z',
          trialEndsAt: '2026-11-20T00:00:00.000Z',
          statusChangedAt: '2026-11-01T00:00:00.000Z',
        },
        {
          id: 'sub_paused',
          serviceId: 'svc_linear',
          planName: 'Paused',
          status: 'paused',
          billingAmount: 10,
          billingCurrency: 'USD',
          billingInterval: 'monthly',
          nextRenewal: '2026-11-10T00:00:00.000Z',
          statusChangedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      servicesById,
      2026,
      10, // November (0-indexed)
    );

    // Nov 4, 11, 18, 25 (4 weekly) + Nov 20 (1 trial conversion) = 5 occurrences
    assert.equal(occurrences.length, 5);
    const trialOcc = occurrences.find((o) => o.subscriptionId === 'sub_trial');
    assert.ok(trialOcc);
    assert.equal(trialOcc.isTrialEnd, true);
    assert.equal(trialOcc.amount, 16);
  });

  it('validates safe URLs, currency formatting, and snooze dates', () => {
    assert.equal(formatCurrency(15.49, 'USD', 'en-US'), '$15.49');
    assert.equal(isSafeExternalUrl('https://netflix.com/cancel'), true);
    assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
    assert.equal(
      isRenewalSnoozed({
        snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      true,
    );
    assert.equal(
      isRenewalSnoozed({
        snoozedUntil: new Date(Date.now() - 86_400_000).toISOString(),
      }),
      false,
    );
  });
});
