import { StatusCard } from '@syncal/ui';
import { SyncTimelinePlaceholder } from 'src/components/dashboard/sync-timeline-placeholder';
import { UnifiedCalendarPlaceholder } from 'src/components/dashboard/unified-calendar-placeholder';

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function ConnectorIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M4 7v6" />
      <path d="M20 11v6" />
      <rect x="7" y="3" width="10" height="6" rx="2" />
      <rect x="7" y="15" width="10" height="6" rx="2" />
      <path d="M7 12h10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="m10.29 3.86-8.18 14.14A1 1 0 0 0 3 19h18a1 1 0 0 0 .87-1.5L13.69 3.86a1 1 0 0 0-1.74 0Z" />
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Monitor connector health, calendar sync state, and upcoming work from a single control surface.
        </p>
      </header>

      <section aria-label="Status summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatusCard
          title="Calendars Synced"
          value="0"
          description="Calendar pairs ready for busy synchronization"
          icon={<CalendarIcon />}
        />
        <StatusCard
          title="Connectors Healthy"
          value="0 / 0"
          description="OAuth and ICS connectors reporting healthy heartbeats"
          tone="positive"
          icon={<ConnectorIcon />}
          footnote="Connector validation will surface last heartbeat data here."
        />
        <StatusCard
          title="Active Alerts"
          value="0"
          description="Open alerts requiring administrator attention"
          tone="warning"
          icon={<AlertIcon />}
          footnote="Alert drawer will live-update with retry and privacy warnings."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <UnifiedCalendarPlaceholder />
        <div className="flex flex-col gap-6">
          <SyncTimelinePlaceholder />
          <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Alerts drawer</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Critical sync errors, privacy warnings, and retry notifications will be accessible from any page via the
              alert icon in the header. Future work will surface unresolved items here for quick triage.
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <p>Upcoming improvements:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Filter alerts by connector, calendar pair, or urgency level.</li>
                <li>Provide quick links to job logs and remediation runbooks.</li>
                <li>Offer acknowledgement workflow to mute noisy alerts.</li>
              </ul>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
