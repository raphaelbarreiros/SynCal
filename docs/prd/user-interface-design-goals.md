# User Interface Design Goals
- **Overall UX Vision**: Deliver a calm, self-service portal that highlights sync health alongside a unified calendar view. Primary interactions stay on the dashboard with progressive disclosure for advanced settings.
- **Key Interaction Paradigms**: Guided wizards for connector setup, card-based dashboards, drawer/modal edits for privacy and fallback ordering, toast notifications for async results, and a persistent theme toggle.
- **Core Screens and Views**:
  1. Unified Dashboard (status tiles + combined calendar).
  2. Connector Management Wizard (OAuth, HTML/ICS, IMAP, self-managed OAuth).
  3. Calendar Detail (privacy toggle, fallback ordering, recent activity timeline).
  4. Logs & Metrics (events processed, failures, backoff history).
  5. Settings (sync window defaults, alert thresholds, theme preference, admin credentials).
- **Accessibility**: Target WCAG AA compliance (contrast, focus outlines, keyboard navigation, ARIA labels).
- **Branding**: Use ShadCN default palette and typography with light/dark themes, allowing easy overrides for adopters.
- **Target Device and Platforms**: Web responsive experience optimized for desktop but functional on tablets/mobile for quick checks.
