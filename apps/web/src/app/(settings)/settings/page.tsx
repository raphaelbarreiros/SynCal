export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Global configuration for sync windows, alert thresholds, appearance, and security controls will live here.
          This placeholder focuses on routing and responsive layout.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configuration areas</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>General settings with sync horizon sliders and optimistic save states.</li>
            <li>Alerts configuration with webhooks, email routing, and dry-run testing.</li>
            <li>Appearance controls for theme selection alongside future accent color options.</li>
            <li>Security tab for password rotation, session timeout, and 2FA placeholders.</li>
          </ul>
        </article>
        <article className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Next steps</h2>
          <p className="mt-2">
            Settings changes will integrate with the shared env helpers in
            <code className="ml-1 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100">packages/config</code> and
            emit audit events for the Logs section to consume.
          </p>
        </article>
      </section>
    </div>
  );
}
