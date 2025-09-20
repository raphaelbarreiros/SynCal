export default function CalendarsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Calendars</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Calendar pairs, privacy controls, and fallback ordering will live here. The current placeholder defines the
          route and surface area for upcoming calendar detail work.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">In scope for future iterations</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>List of calendar pairs with quick metrics (last sync, privacy mode, active alerts).</li>
          <li>Detail view tabs for Overview, Connectors &amp; Fallback, Privacy &amp; Title Mode, and Activity Log.</li>
          <li>Safeguarded removal workflow that prompts to delete or keep mirrored events.</li>
        </ul>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          This route will also expose shortcuts back to the unified calendar and sync timeline so administrators can
          verify changes immediately.
        </p>
      </section>
    </div>
  );
}
