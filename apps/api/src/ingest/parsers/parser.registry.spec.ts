import { parseEmailReceipt, selectEmailReceiptParser } from './parser.registry';
import { ReceiptEmailInput } from './parser.types';

const receivedAt = '2026-07-01T12:00:00.000Z';

describe('email receipt parser registry', () => {
  it('parses a Netflix receipt using the trusted provider parser', () => {
    const input: ReceiptEmailInput = {
      sender: 'Netflix <info@account.netflix.com>',
      subject: 'Your Netflix receipt',
      receivedAt,
      body: [
        'Netflix Premium',
        'Amount charged: $22.99',
        'Next billing date: August 1, 2026',
        'Visa ending in 4242',
        'Billed monthly',
      ].join('\n'),
    };

    const result = parseEmailReceipt(input);

    expect(result.parserId).toBe('netflix');
    expect(result.items).toEqual([
      expect.objectContaining({
        providerName: 'Netflix',
        planName: 'Netflix Premium',
        billingAmount: 22.99,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        nextRenewal: '2026-08-01T00:00:00.000Z',
        paymentSource: 'card',
        paymentLast4: '4242',
        confidence: 0.97,
      }),
    ]);
  });

  it('parses Spotify plan and localized currency details', () => {
    const result = parseEmailReceipt({
      sender: 'no-reply@spotify.com',
      subject: 'Your Spotify payment receipt',
      receivedAt,
      body: 'Spotify Premium Family\nPayment: EUR 19,99\nRenews yearly on the same date',
    });

    expect(result.parserId).toBe('spotify');
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        providerName: 'Spotify',
        planName: 'Spotify Premium Family',
        billingAmount: 19.99,
        billingCurrency: 'EUR',
        billingInterval: 'yearly',
      }),
    );
  });

  it('returns each Apple subscription as a separate item and ignores totals', () => {
    const result = parseEmailReceipt({
      sender: 'Apple <no_reply@apple.com>',
      subject: 'Your receipt from Apple',
      receivedAt,
      body: [
        'Apple Music',
        'Monthly',
        'Renews: August 12, 2026',
        '$10.99',
        '',
        'iCloud+ 200 GB',
        'Monthly',
        'Renews: August 15, 2026',
        '$2.99',
        '',
        'Subtotal $13.98',
        'Tax $0.00',
        'Total $13.98',
        'Visa ending in 1234',
      ].join('\n'),
    });

    expect(result.parserId).toBe('apple');
    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual([
      expect.objectContaining({
        providerName: 'Apple Music',
        merchantName: 'Apple',
        billingAmount: 10.99,
        nextRenewal: '2026-08-12T00:00:00.000Z',
      }),
      expect.objectContaining({
        providerName: 'iCloud+',
        planName: 'iCloud+ 200 GB',
        merchantName: 'Apple',
        billingAmount: 2.99,
        nextRenewal: '2026-08-15T00:00:00.000Z',
      }),
    ]);
  });

  it('parses Amazon Prime, Disney+, YouTube Premium, Xbox, PlayStation, and Steam receipts', () => {
    expect(
      parseEmailReceipt({
        sender: 'digital-no-reply@amazon.com',
        subject: 'Your Amazon Prime membership renewal',
        body: 'Amount charged: $14.99 monthly. Next billing date: August 10, 2026',
        receivedAt,
      }).items[0],
    ).toEqual(
      expect.objectContaining({
        providerName: 'Amazon Prime',
        billingAmount: 14.99,
        billingInterval: 'monthly',
      }),
    );

    expect(
      parseEmailReceipt({
        sender: 'disneyplus@mail.disneyplus.com',
        subject: 'Disney+ Bundle invoice',
        body: 'Charged: $19.99 per month',
        receivedAt,
      }).items[0],
    ).toEqual(
      expect.objectContaining({
        providerName: 'Disney+',
        planName: 'Disney+ Bundle',
        billingAmount: 19.99,
      }),
    );

    expect(
      parseEmailReceipt({
        sender: 'googleplay-noreply@google.com',
        subject: 'Your YouTube Premium Family receipt',
        body: 'Amount: $22.99 monthly',
        receivedAt,
      }).items[0],
    ).toEqual(
      expect.objectContaining({
        providerName: 'YouTube Premium',
        planName: 'YouTube Premium Family',
        billingAmount: 22.99,
      }),
    );

    expect(
      parseEmailReceipt({
        sender: 'microsoft-noreply@microsoft.com',
        subject: 'Xbox Game Pass Ultimate recurring charge',
        body: 'Amount: $19.99 monthly',
        receivedAt,
      }).items[0],
    ).toEqual(
      expect.objectContaining({
        providerName: 'Xbox Game Pass',
        planName: 'Xbox Game Pass Ultimate',
        billingAmount: 19.99,
      }),
    );

    expect(
      parseEmailReceipt({
        sender: 'sony@email.playstation.com',
        subject: 'PlayStation Plus Extra renewal receipt',
        body: 'Price: $14.99 monthly',
        receivedAt,
      }).items[0],
    ).toEqual(
      expect.objectContaining({
        providerName: 'PlayStation Plus',
        planName: 'PlayStation Plus Extra',
        billingAmount: 14.99,
      }),
    );

    expect(
      parseEmailReceipt({
        sender: 'noreply@steampowered.com',
        subject: 'Thank you for your Steam subscription purchase',
        body: 'Subscription: Dota Plus\nPrice: $3.99 monthly',
        receivedAt,
      }).items[0],
    ).toEqual(
      expect.objectContaining({
        providerName: 'Steam',
        planName: 'Dota Plus',
        billingAmount: 3.99,
      }),
    );
  });

  it('detects cancellation confirmation emails and trial welcome emails', () => {
    const cancelResult = parseEmailReceipt({
      sender: 'info@account.netflix.com',
      subject: 'Your Netflix subscription cancelled',
      body: 'Cancellation confirmed. Your membership ends on August 15, 2026.',
      receivedAt,
    });
    expect(cancelResult.items[0]).toEqual(
      expect.objectContaining({
        providerName: 'Netflix',
        lifecycleIntent: 'cancellation',
        nextRenewal: '2026-08-15T00:00:00.000Z',
      }),
    );

    const trialResult = parseEmailReceipt({
      sender: 'no-reply@spotify.com',
      subject: 'Welcome to your free trial of Spotify Premium Individual',
      body: 'Your 30-day free trial started. Trial ends August 1, 2026, then $11.99 monthly.',
      receivedAt,
    });
    expect(trialResult.items[0]).toEqual(
      expect.objectContaining({
        providerName: 'Spotify',
        lifecycleIntent: 'trial_start',
        trialEndsAt: '2026-08-01T00:00:00.000Z',
        billingAmount: 11.99,
      }),
    );
  });

  it('uses generic low-confidence parsing for unsupported providers', () => {
    const input: ReceiptEmailInput = {
      sender: 'billing@dropbox.com',
      subject: 'Your subscription receipt',
      receivedAt,
      body: 'Amount paid: USD 11.99 per month. Card ending in 9876.',
    };

    expect(selectEmailReceiptParser(input).id).toBe('generic');
    expect(parseEmailReceipt(input)).toEqual(
      expect.objectContaining({
        parserId: 'generic',
        confidence: 0.45,
        warnings: ['Parsed with generic heuristics; review is recommended.'],
        items: [
          expect.objectContaining({
            providerName: 'Dropbox',
            billingAmount: 11.99,
            billingInterval: 'monthly',
            confidence: 0.45,
          }),
        ],
      }),
    );
  });

  it('returns an auditable warning instead of fabricating a missing amount', () => {
    const result = parseEmailReceipt({
      sender: 'info@netflix.com',
      subject: 'Welcome to Netflix',
      body: 'Enjoy your membership.',
      receivedAt,
    });

    expect(result).toEqual(
      expect.objectContaining({
        parserId: 'netflix',
        confidence: 0,
        items: [],
        warnings: ['No Netflix billing amount was found.'],
      }),
    );
  });
});
