# Gmail OAuth Setup

SubSync uses Google OAuth with read-only Gmail access to import billing and subscription emails locally.

## 1. Create Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Gmail API**.
4. Configure the OAuth consent screen (External is fine for local/desktop use).
5. Create **OAuth client ID** credentials of type **Web application**.
6. Add this authorized redirect URI:

```
http://127.0.0.1:43100/api/gmail/callback
```

## 2. Configure environment variables

Copy `.env.example` to `.env` in the repo root (or set env vars for the API process) and fill in:

```env
GOOGLE_OAUTH_CLIENT_ID="your-client-id"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="http://127.0.0.1:43100/api/gmail/callback"
GMAIL_OAUTH_RETURN_URL="http://127.0.0.1:43101/connect"
```

Optional:

```env
OAUTH_TOKEN_ENCRYPTION_KEY="<base64-encoded 32-byte key>"
```

If omitted, tokens are encrypted with a key derived from `DATABASE_URL`.

## 3. Connect Gmail in the app

1. Start the API and web UI (`npm run dev:api` and `npm run dev:web`) or launch the desktop app.
2. Open **Connections**.
3. Click **Connect Gmail** and complete Google sign-in in your browser.
4. After redirect, SubSync stores encrypted tokens locally and can sync billing emails.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/gmail/status` | Connection status |
| `GET` | `/api/gmail/auth-url` | Start OAuth flow |
| `GET` | `/api/gmail/callback` | OAuth redirect handler |
| `POST` | `/api/gmail/sync` | Import billing emails now |
| `POST` | `/api/gmail/disconnect` | Revoke and remove stored tokens |

Background sync runs every 6 hours when Gmail is connected.
