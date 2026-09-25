import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSubscriptionDto } from './create-subscription.dto';
import { UpdateSubscriptionDto } from './update-subscription.dto';

const base = {
  serviceId: 'svc_peacock',
  planName: 'Premium',
  billingAmount: 10.99,
  billingCurrency: 'USD',
  billingInterval: 'monthly',
  nextRenewal: '2026-10-01T00:00:00.000Z',
};

async function errorsFor(
  dto: typeof CreateSubscriptionDto | typeof UpdateSubscriptionDto,
  payload: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(dto, payload));
  return errors.map((error) => error.property);
}

describe('subscription DTO trial validation', () => {
  it('requires trialEndsAt when creating a trial', async () => {
    await expect(
      errorsFor(CreateSubscriptionDto, { ...base, status: 'trial' }),
    ).resolves.toEqual(['trialEndsAt']);
  });

  it('accepts a trial with an ISO trial end date', async () => {
    await expect(
      errorsFor(CreateSubscriptionDto, {
        ...base,
        status: 'trial',
        trialEndsAt: '2026-10-01T00:00:00.000Z',
      }),
    ).resolves.toEqual([]);
  });

  it('rejects a malformed trial end date', async () => {
    await expect(
      errorsFor(CreateSubscriptionDto, {
        ...base,
        status: 'active',
        trialEndsAt: 'next week',
      }),
    ).resolves.toEqual(['trialEndsAt']);
  });

  it('does not require trialEndsAt for non-trial subscriptions', async () => {
    await expect(errorsFor(CreateSubscriptionDto, base)).resolves.toEqual([]);
  });

  it('lets partial updates omit or clear trialEndsAt', async () => {
    await expect(
      errorsFor(UpdateSubscriptionDto, { status: 'trial' }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(UpdateSubscriptionDto, { trialEndsAt: null }),
    ).resolves.toEqual([]);
  });
});
