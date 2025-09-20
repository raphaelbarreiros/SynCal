export default function ConnectorsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Connectors</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manage OAuth, HTML-ICS, IMAP, and self-managed connectors. This stub establishes the route and layout while
          the connector wizard and validation flows are implemented in upcoming stories.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Planned capabilities</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Wizard-based onboarding for Google Workspace, Microsoft 365, HTML/ICS feeds, and IMAP connectors.</li>
            <li>Inline validation buttons to test connectivity and display actionable remediation guidance.</li>
            <li>Visual status badges showing token expiry, retry health, and privacy modes.</li>
          </ul>
        </article>

        <article className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Coming next</h2>
          <p className="mt-2">
            The connectors registry aligns with the architecture spec and will reuse shared adapters from
            <code className="ml-1 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100">packages/connectors</code>.
            The UI binding will surface connector-specific forms and link back to calendar pairs.
          </p>
        </article>
      </section>
    </div>
  );
}
