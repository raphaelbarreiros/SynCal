export function UnifiedCalendarPlaceholder() {
  return (
    <section
      aria-labelledby="unified-calendar-placeholder"
      className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="unified-calendar-placeholder" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Unified calendar overview
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Connect your source and destination calendars to preview mirrored availability.
          </p>
        </div>
        <span
          aria-hidden="true"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          Empty state
        </span>
      </header>
      <div className="mt-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Once connectors are configured, this panel will render a unified view of busy events across all connected
          calendars. For now, it provides quick guidance for first-time setup:
        </p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Use the Connectors section to add your first provider (Google Workspace, Microsoft 365, or custom ICS).</li>
          <li>Assign at least one source and destination calendar to build your first calendar pair.</li>
          <li>Return here to verify mirrored availability and jump into the sync timeline for deeper debugging.</li>
        </ol>
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-100/70 p-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
          Tip: Privacy defaults to Busy titles. You can review and update privacy modes in Calendars → Privacy &amp; Title
          Mode.
        </p>
      </div>
    </section>
  );
}
