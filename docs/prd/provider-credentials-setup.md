# Provider Credentials Setup (Google & Microsoft)

This guide helps you create OAuth apps for Google Calendar and Microsoft Graph and wire them to SynCal via environment variables. Users own the creation of provider credentials; the app consumes them from environment variables and never stores them in plaintext.

## Security & Ownership
- Never commit real secrets to Git. Use `.env.local` for development, Docker/OS secrets for production.
- SynCal encrypts connector secrets at rest using a master key from `ENCRYPTION_MASTER_KEY`.
- Users provision provider apps and secrets; SynCal reads them from env only.

## Who Does What
- User/Operator: Create OAuth apps (consent screen, scopes, test users), copy client IDs/secrets, and populate env vars in the deployment environment.
- Developer Agent: Implement callback endpoints, store tokens encrypted, and ensure logs never contain secrets. Provide env schema validation and clear error messages when credentials are missing.
- Reference: See `docs/prd/roles-and-responsibilities.md` for the complete responsibility matrix.

## URLs & Redirects
- Local development (recommended defaults):
  - `APP_BASE_URL`: `http://localhost:3000`
  - `API_BASE_URL`: `http://localhost:3001`
  - Google Redirect URI: `http://localhost:3001/auth/google/callback`
  - Microsoft Redirect URI: `http://localhost:3001/auth/microsoft/callback`
- Production: Replace `localhost` with your domain and update env vars accordingly.

---

## Google Calendar (OAuth 2.0)
1) Create project and enable API
   - Visit Google Cloud Console → Select/Create a project
   - APIs & Services → Enable APIs & Services → Search “Google Calendar API” → Enable

2) Configure OAuth consent screen
   - APIs & Services → OAuth consent screen → External (or Internal for Workspace) → Fill in app info
   - Add scopes (recommended):
     - `https://www.googleapis.com/auth/calendar` (read/write)
     - `openid`, `email`, `profile`

3) Create OAuth client credentials
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000` (and your production origin)
   - Authorized redirect URIs: `http://localhost:3001/auth/google/callback` (and production callback)
   - Save Client ID and Client Secret

4) Set environment variables
   - `GOOGLE_CLIENT_ID` = your client ID
   - `GOOGLE_CLIENT_SECRET` = your client secret
   - `GOOGLE_REDIRECT_URI` = `http://localhost:3001/auth/google/callback`
   - `GOOGLE_OAUTH_SCOPES` = `openid email profile https://www.googleapis.com/auth/calendar`

5) Consent verification
   - If using External publishing status, keep “Testing” for development and add your test user emails.

---

## Microsoft Graph (Calendars)
1) Register an application
   - Azure Portal → Azure Active Directory → App registrations → New registration
   - Name: e.g., “SynCal Local”
   - Supported account types: Choose as needed (for most, “Accounts in any organizational directory”)
   - Redirect URI (type Web): `http://localhost:3001/auth/microsoft/callback`

2) Create a client secret
   - App → Certificates & secrets → New client secret → Copy the value (shown once)

3) Add API permissions
   - App → API permissions → Add a permission → Microsoft Graph → Delegated permissions
   - Add: `Calendars.ReadWrite`, `offline_access`, `openid`, `email`, `profile`
   - Grant admin consent if required by your tenant policy

4) Gather values
   - `MS_CLIENT_ID` = Application (client) ID
   - `MS_CLIENT_SECRET` = Client secret value
   - `MS_TENANT_ID` = Directory (tenant) ID (or use `common`)

5) Set environment variables
   - `MS_CLIENT_ID` = (above)
   - `MS_CLIENT_SECRET` = (above)
   - `MS_TENANT_ID` = `common` (or your tenant ID)
   - `MS_REDIRECT_URI` = `http://localhost:3001/auth/microsoft/callback`
   - `MS_OAUTH_SCOPES` = `openid email profile offline_access Calendars.ReadWrite`

---

## Example Environment Keys
Add these to `.env.local` for development (see `.env.example` for a template):

```bash
# Base URLs
APP_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3001

# Session & crypto
SESSION_SECRET=change-me-session-secret
ENCRYPTION_MASTER_KEY=base64:CHANGE_ME_32_BYTES

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
GOOGLE_OAUTH_SCOPES="openid email profile https://www.googleapis.com/auth/calendar"

# Microsoft
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=common
MS_REDIRECT_URI=http://localhost:3001/auth/microsoft/callback
MS_OAUTH_SCOPES="openid email profile offline_access Calendars.ReadWrite"
```

---

## Verification Checklist
- OAuth apps created and correct redirect URIs added
- `.env.local` contains client IDs, secrets, scopes, and redirect URIs
- For Google: Calendar API enabled and test users added (if External testing)
- For Microsoft: Required delegated permissions granted (admin consent if needed)

---

## Notes on Other Connectors
- HTML/ICS: No credentials needed; URLs and optional headers are configured in-app.
- IMAP: Credentials entered in-app; stored encrypted using `ENCRYPTION_MASTER_KEY`.

## Security Reminders
- Do not commit `.env*` files. This repository’s `.gitignore` already excludes them.
- Rotate secrets periodically. Update environment and restart services to apply.
