import type { ReactNode } from 'react';

export type StatusTone = 'neutral' | 'positive' | 'warning';

interface StatusCardProps {
  title: string;
  value: string;
  description: string;
  tone?: StatusTone;
  icon?: ReactNode;
  footnote?: string;
}

const toneClasses: Record<StatusTone, string> = {
  neutral:
    'border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
  positive:
    'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 shadow-sm dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-100'
};

export function StatusCard({ title, value, description, tone = 'neutral', icon, footnote }: StatusCardProps) {
  const headingId = `status-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <article
      className={`flex h-full flex-col justify-between gap-3 rounded-2xl border p-5 transition-colors ${toneClasses[tone]}`}
      aria-labelledby={headingId}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id={headingId} className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold leading-tight">{value}</p>
        </div>
        {icon && <span aria-hidden="true" className="text-slate-500 dark:text-slate-400">{icon}</span>}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
      {footnote ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{footnote}</p>
      ) : null}
    </article>
  );
}
