export default function LogsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Logs</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Job history, retries, and audit logs will surface here. This stub locks the URL structure so telemetry work can
          layer on without reshaping navigation.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upcoming features</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Filterable job history with status, duration, connector, and calendar context.</li>
            <li>Inline access to full log payloads and structured error details.</li>
            <li>Export hooks for Prometheus metrics and alert routing.</li>
          </ul>
        </article>
        <article className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Traceability goals</h2>
          <p className="mt-2">
            Every job entry will link back to connector validations, calendar pairs, and alert drawer items so admins can
            diagnose issues in under two minutes, matching the usability targets in the UX specification.
          </p>
        </article>
      </section>
    </div>
  );
}
