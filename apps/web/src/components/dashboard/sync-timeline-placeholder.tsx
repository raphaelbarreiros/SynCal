export function SyncTimelinePlaceholder() {
  return (
    <section
      aria-labelledby="sync-timeline-placeholder"
      className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="sync-timeline-placeholder" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sync timeline
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Recent job runs and retries will appear here once calendar pairs are configured.
          </p>
        </div>
        <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Coming soon
        </span>
      </header>
      <div className="mt-5 space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            <span
              aria-hidden="true"
              className="mt-1 h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"
            />
            <div>
              <p className="font-medium">Job placeholder #{item}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sync events with full retry diagnostics will be displayed in this timeline in a future story.
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
