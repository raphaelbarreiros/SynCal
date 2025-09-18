# Post‑MVP: Analytics & Feedback

This document outlines a lightweight plan for collecting product feedback without third‑party analytics and with privacy in mind.

## MVP Stance
- No third‑party analytics SDKs
- Optional feedback mechanisms only

## Feedback Mechanisms
- "Send Feedback" link in the portal footer: `mailto:` to the operator’s configured address
- Optional webhook endpoint (self-hosted) to receive short text feedback
- Rate-limit and captcha (if public) to avoid abuse

## Event Logging (Local Only, Optional)
- Log anonymized UI events locally for troubleshooting (disabled by default)
- Configured via env flags; logs never leave the host

## Privacy
- No PII in feedback payloads by default
- Clear opt‑in toggle and description in Settings if local event logging is enabled

## Next Steps
- Add Settings fields for feedback email and optional webhook URL
- Implement `mailto:` footer link and (optional) webhook form
