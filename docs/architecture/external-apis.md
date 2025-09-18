## External APIs

### Google Calendar API
- **Purpose:** OAuth-secured calendar access for reading/updating events during sync.
- **Documentation:** https://developers.google.com/calendar/api
- **Base URL(s):** https://www.googleapis.com/calendar/v3
- **Authentication:** OAuth 2.0 installed application flow (offline access + refresh tokens)
- **Rate Limits:** 1,000,000 queries/day per project; per-user quotas enforced (default 10/sec)

**Key Endpoints Used:**
- `GET /calendars/{calendarId}/events` – Fetch window of upcoming events (supports syncToken for incremental sync)
- `POST /calendars/{calendarId}/events` – Create mirrored events
- `PATCH /calendars/{calendarId}/events/{eventId}` – Update mirrored events with idempotent mapping
- `DELETE /calendars/{calendarId}/events/{eventId}` – Remove mirrored events when source deletes

**Integration Notes:** Ensure `Calendars.ReadWrite` equivalent scope; enable incremental sync via sync tokens to minimize quota usage; store refresh tokens encrypted with libsodium; respect user-configured privacy mode by updating summaries accordingly.

### Microsoft Graph Calendar API
- **Purpose:** Provide Microsoft 365 calendar access for reading/updating events.
- **Documentation:** https://learn.microsoft.com/graph/api/resources/event?view=graph-rest-1.0
- **Base URL(s):** https://graph.microsoft.com/v1.0
- **Authentication:** OAuth 2.0 authorization code (MSAL) with offline_access; application registered per tenant or self-managed credentials
- **Rate Limits:** Dynamic; default 10,000 requests per 10 minutes per app per tenant (Graph throttling guidance)

**Key Endpoints Used:**
- `GET /me/calendars/{calendarId}/events` – Retrieve events within configurable window (uses delta queries)
- `POST /me/calendars/{calendarId}/events` – Create mirrored events
- `PATCH /me/calendars/{calendarId}/events/{eventId}` – Apply updates from source calendar
- `DELETE /me/calendars/{calendarId}/events/{eventId}` – Remove mirrored items when necessary

**Integration Notes:** Use delta queries for efficient sync; handle 429 throttling via exponential backoff matching SyncJob retry logic; require `Calendars.ReadWrite` scope; tenant admins may opt into self-managed app registration—document redirect URI setup in portal.

### HTML/ICS Feeds
- **Purpose:** Read-only ingestion when OAuth is unavailable by parsing iCalendar feeds.
- **Documentation:** RFC 5545 (iCalendar), consumer-provided feed docs
- **Base URL(s):** User-supplied HTTPS URL to `.ics` feed
- **Authentication:** Optional basic auth or token header supplied by connector configuration
- **Rate Limits:** Dependent on provider; default to 15-minute polling minimum to avoid bans

**Key Endpoints Used:**
- `GET {feedUrl}` – Retrieve iCalendar payload for upcoming events

**Integration Notes:** Parse via `node-ical`; respect caching headers (`ETag`, `Last-Modified`) to reduce load; validate HTTP 200 + MIME `text/calendar`; fall back gracefully when feeds return partial data or duplicate UIDs.

### IMAP Mailboxes
- **Purpose:** Ingest inbound meeting invitations when OAuth feeds are blocked.
- **Documentation:** RFC 3501 (IMAP4rev1)
- **Base URL(s):** Connector-provided hostname/port (e.g., imap.example.com:993)
- **Authentication:** Username + app password/IMAP credentials stored encrypted; supports STARTTLS/SSL
- **Rate Limits:** Mailbox-specific; respect provider guidance by limiting polling frequency (default every 5 minutes)

**Key Endpoints Used:**
- `LOGIN`, `SELECT`, `SEARCH`, `FETCH` commands – Retrieve unread invite emails
- `STORE` – Flag processed messages to avoid reprocessing

**Integration Notes:** Use IMAP IDLE when available; parse `text/calendar` attachments to create `SourceEvent` entries; require admin to provision dedicated mailbox or forwarding rule; document cleanup tasks to archive processed messages.


