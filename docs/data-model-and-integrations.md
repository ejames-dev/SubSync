# Data Model & Provider Integrations (V1: Streaming + Media)

## Core Entities

### User
| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `email` | string | Login + notification channel |
| `auth_provider` | enum | passwordless, Google, Apple |
| `timezone` | string (IANA) | Drives reminder scheduling |
| `created_at` / `updated_at` | timestamptz | Auditing |

### Service
Catalog of recognizable streaming/media providers. Pre-seeded.
| Field | Type | Notes |
| `id` | UUID |
| `name` | string | e.g., "Netflix" |
| `slug` | string | kebab case |
| `category` | enum | streaming, music, gaming |
| `logo_url` | string | CDN reference |
| `supports_oauth` | bool |
| `metadata` | jsonb | API endpoints, scopes, email parsing rules |

### Subscription
Normalized representation of an active plan.
| Field | Type | Notes |
| `id` | UUID |
| `user_id` | UUID | FK → User |
| `service_id` | UUID | FK → Service |
| `plan_name` | string | e.g., "Premium UHD" |
| `status` | enum | active, trial, canceled_pending |
| `billing_amount` | decimal(10,2) | Stored in service currency |
| `billing_currency` | ISO 4217 |
| `billing_interval` | enum | monthly, yearly, custom |
| `next_renewal` | date |
| `start_date` | date |
| `payment_source` | enum | card, PayPal, gift balance |
| `payment_last4` | string | optional |
| `auto_import_source` | enum | oauth, email, manual |
| `metadata` | jsonb | provider-specific fields |
| `created_at` / `updated_at` | timestamptz |

### SubscriptionEvent (history)
Tracks changes for analytics & audit.
| Field | Type | Notes |
| `id` | UUID |
| `subscription_id` | UUID |
| `event_type` | enum | created, amount_changed, renewal, cancellation |
| `payload` | jsonb | Snapshot of relevant data |
| `occurred_at` | timestamptz |

### NotificationPreference
| Field | Type | Notes |
| `id` | UUID |
| `user_id` | UUID |
| `event` | enum | renewal_upcoming, price_change |
| `delivery_channel` | enum | email, push |
| `lead_time_days` | int |

### EmailReceipt
Stores parsed email metadata for traceability.
| Field | Type | Notes |
| `id` | UUID |
| `user_id` | UUID |
| `provider` | string | Gmail, Outlook |
| `message_id` | string |
| `subject` | string |
| `parsed_at` | timestamptz |
| `extracted_fields` | jsonb |

## JSON Example (Subscription)
```json
{
  "id": "sub_123",
  "user_id": "usr_456",
  "service_id": "svc_netflix",
  "plan_name": "Standard",
  "status": "active",
  "billing_amount": "15.49",
  "billing_currency": "USD",
  "billing_interval": "monthly",
  "next_renewal": "2026-04-12",
  "payment_source": "card",
  "payment_last4": "4242",
  "auto_import_source": "email",
  "metadata": {
    "profile_count": 2,
    "hd": true
  }
}
```

## Provider Integration Checklist (Streaming + Media)

| Provider | Path | Auth | Key Data Points | Notes |
| --- | --- | --- | --- | --- |
| Spotify | OAuth (Accounts API) | OAuth 2.0 (user-read-email + user-read-private) | Plan type, renewal date, country | Exposes subscription info for Premium; need to handle family plans. |
| YouTube Premium | OAuth via Google | OAuth 2.0 (YouTube + payments scopes) | Status, renewal cadence | Renewal data buried in Google Play API; may require Play Developer service account. |
| Netflix | Email parsing + manual | No public API | Plan, price, renewal date from receipt | Encourage users to forward billing emails to unique alias. |
| Disney+ | Email parsing | No public API | Same as Netflix | Detect via subject lines "Your Disney+ payment" etc. |
| Apple TV+ | Apple receipt parsing | Sign in with Apple, App Store server APIs | Renewals, price, device region | App Store Server Notifications (requires server-to-server tokens). |
| Hulu | Email parsing | No public API | Plan, add-ons | Add plan metadata for bundles (e.g., Hulu + Disney). |
| Amazon Prime Video | Amazon Pay API (future) | OAuth + Amazon Pay permissions | Renewal amount, charge method | V1 fallback: email parsing from Amazon receipts. |
| Paramount+ | Email parsing | No public API | plan, renewal | Similar to Hulu. |

### Integration Priorities
1. **Spotify + Google/YouTube** for instant-gratification OAuth onboarding.
2. **Email ingestion pipeline** for Netflix/Disney/Hulu (covers majority of remaining subscriptions).
3. **App Store receipts** if targeting Apple-heavy audiences (requires paid developer setup, store-server API). |

### Email Parsing Requirements
- Unique per-user forwarding address (e.g., `subs+{userID}@track.app`).
- SES/Sendgrid inbound processing → parse subject, body, amounts, renewal date.
- ML/ heuristics pipeline stored in `EmailReceipt.extracted_fields` for traceability.

### Token & Credential Handling
- Encrypt OAuth refresh tokens with KMS / DPAPI.
- Store provider-specific scopes in `Service.metadata` for dynamic onboarding flows.
- Background jobs refresh tokens before expiry and log failures for user re-auth prompts.
