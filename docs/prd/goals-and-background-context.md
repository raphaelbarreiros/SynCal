# Goals and Background Context
## Goals
- Deliver a self-hosted, fully authenticated SynCal instance deployable with one `docker compose up` command.
- Provide configurable connectors (OAuth, HTML/ICS, IMAP, self-managed OAuth) with validation and encrypted secret storage.
- Keep events synchronized across linked calendars with privacy controls, idempotent updates, and user-driven disconnect safeguards.
- Surface unified availability and health metrics in a responsive Next.js + ShadCN portal.
- Enable reliable monitoring, alerting, and auditability so admins can maintain trust without shell access.

## Background Context
Cross-organization professionals routinely juggle multiple Google Workspace and Microsoft 365 calendars that fall out of sync. Manual copying wastes time and causes double-bookings, yet many organizations block third-party OAuth apps, limiting existing tooling. SynCal addresses those gaps by combining lifecycle event mirroring, multiple fallback connectors (OAuth, HTML/ICS, IMAP, self-managed), and strong privacy defaults. The project’s Docker-first delivery plus transparent portal aim to keep adoption painless for self-hosters while remaining open source and community driven.

## Change Log
| Date       | Version | Description        | Author             |
|------------|---------|--------------------|--------------------|
| 2025-09-18 | v0.1    | Initial PRD draft. | Raphael Barreiros |
