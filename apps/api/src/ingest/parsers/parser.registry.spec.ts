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
        providerName: 'iCloud+ 200 GB',
        merchantName: 'Apple',
        billingAmount: 2.99,
        nextRenewal: '2026-08-15T00:00:00.000Z',
      }),
    ]);
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
