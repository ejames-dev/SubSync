# SubSync v1.0.1

## What's changed

### Bug fixes
- **Dashboard monthly spend** now correctly excludes `canceled_pending` subscriptions from the monthly equivalent spend calculation and spend-by-category breakdown. Subscriptions in the process of being canceled are no longer counted toward your ongoing costs.
- **Unit tests** (`subscriptions.service.spec.ts`) corrected: the `ServiceCatalogService` dependency is now properly mocked in the constructor, and the subscription entity fixture uses the correct `billingAmountCents` integer field instead of the wrong `billingAmount` Decimal. All five test cases now pass.

### Improvements
- **Global HTTP exception filter** added to the API (`common/http-exception.filter.ts`). All error responses now return a consistent JSON envelope `{ statusCode, message, error }` regardless of whether the error originated from a `HttpException`, a validation pipe failure, or an unexpected runtime error. Unexpected server errors are also logged with a stack trace via NestJS `Logger`.
- **Stronger DTO validation** across the API:
  - `CreateSubscriptionDto`: `planName` capped at 150 characters, `billingCurrency` capped at 3 characters, `serviceId` capped at 100 characters, `notes` capped at 1,000 characters, `paymentLast4` capped at 4 characters, and `paymentSource` now validated with `@IsIn` instead of the looser `@IsString`.
  - `UpdateSettingsDto`: `leadTimeDays` now has an upper bound of 365 days.
  - `EmailIngestPayload`: `body` field now capped at 50 000 characters.
- **Web API layer consolidated**: `subscription-form.tsx` previously issued raw `fetch` calls and duplicated the API base-URL resolution logic. It now uses the typed helpers `createSubscription`, `updateSubscription`, and `deleteSubscription` from `lib/api.ts`. A new `updateSubscription` export was added to `lib/api.ts`, and the `billingCurrency` field enforces a `maxLength={3}` HTML attribute in the form.

## Upgrade notes
No database migrations required. Drop in the new executable and restart; all existing data remains compatible.

## Validation
```
npm run lint
npm run test --workspace api
npm run build:desktop
```

## Known limitations
- Provider sync is not yet a full live OAuth integration.
- The portable executable is unsigned; Windows SmartScreen may warn on first launch.
