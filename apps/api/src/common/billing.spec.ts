import { parseBillingInterval, toMonthlyEquivalent } from './billing';

describe('billing helpers', () => {
  it.each([
    ['monthly', 12, 12],
    ['yearly', 120, 10],
    ['quarterly', 30, 10],
    ['custom', 7, 7],
  ] as const)(
    'normalizes %s billing to a monthly equivalent',
    (interval, amount, expected) => {
      expect(toMonthlyEquivalent(amount, interval)).toBe(expected);
    },
  );

  it('falls back to monthly for unknown stored intervals', () => {
    expect(parseBillingInterval('yearly')).toBe('yearly');
    expect(parseBillingInterval('weekly')).toBe('monthly');
  });
});
