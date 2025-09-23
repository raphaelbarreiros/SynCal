## Data Models

### AdminUser
**Purpose:** Represents each local administrator responsible for configuring SynCal and authenticating into the portal.

**Key Attributes:**
- `id`: UUID — primary key
- `email`: string — unique admin login
- `password_hash`: string — Argon2 hash of the credential

**Relationships:**
- Has many `AuditLog` entries
- Creates and manages `Connector` records

### Connector
**Purpose:** Stores connector configuration and encrypted credential payloads for Google, Microsoft, HTML/ICS, IMAP, or self-managed OAuth flows.

**Key Attributes:**
- `id`: UUID — primary key
- `type`: enum — connector strategy (`google`, `microsoft`, `html_ics`, `imap`, `self_managed`)
- `credentials_encrypted`: bytea — libsodium sealed payload containing tokens/secret material

**Relationships:**
- Belongs to `AdminUser`
- Has many `Calendar` records
- Participates in `SyncJob` scheduling through associated calendars

### Calendar
**Purpose:** Represents a single calendar surface—either source or target—and captures privacy preferences.

**Key Attributes:**
- `id`: UUID — primary key
- `provider_calendar_id`: string — external calendar identifier
- `display_name`: string — admin-facing label stored verbatim (HTML/ICS connectors persist the wizard's target calendar label here)
- `privacy_mode`: enum — `original_title` or `busy_placeholder`

**Relationships:**
- Belongs to `Connector`
- Participates in `SyncPair` configurations
- Has many `EventMapping` entries as source or mirror calendar

**Notes:**
- HTML/ICS connectors do not discover calendars remotely; the wizard-supplied target calendar label is stored in `display_name` and surfaced via the `targetCalendarLabel` DTO field.

### SyncPair
**Purpose:** Defines the relationship between calendars that should stay in sync, including fallback ordering across connectors.

**Key Attributes:**
- `id`: UUID — primary key
- `primary_calendar_id`: UUID — FK to `Calendar`
- `fallback_order`: array<string> — ordered list of connector IDs representing failover sequence

**Relationships:**
- Has many `SyncJob` entries targeting the pair
- References `Calendar` records in primary and secondary roles

### SyncJob
**Purpose:** Acts as the durable queue entry that orchestrates sync runs, retries, and window boundaries.

**Key Attributes:**
- `id`: UUID — primary key
- `status`: enum — `pending`, `in_progress`, `retrying`, `failed`, `completed`
- `next_run_at`: timestamptz — scheduled execution timestamp

**Relationships:**
- Belongs to `SyncPair`
- Generates `SyncJobLog` records after completion
- Consumed by the worker execution pipeline

### EventMapping
**Purpose:** Maintains idempotent mappings between source events and mirrored events across calendars to ensure consistent update/delete operations.

**Key Attributes:**
- `id`: UUID — primary key
- `source_event_id`: string — provider event identifier
- `mirror_event_id`: string — corresponding mirrored event identifier

**Relationships:**
- Belongs to `SyncPair`
- References `Calendar` records for source and mirror contexts
- Consulted by `SyncJob` executions to determine create/update/delete behavior

### AuditLog
**Purpose:** Records administrative actions, connector changes, and notable system events for traceability and compliance.

**Key Attributes:**
- `id`: UUID — primary key
- `actor_id`: UUID — FK to `AdminUser`
- `action`: string — descriptive event label

**Relationships:**
- Belongs to `AdminUser`
- Optionally references `Connector` or `SyncPair` for additional context