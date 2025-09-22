import type { ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '../primitives/card';
import { cn } from '../utils/cn';

export type StatusTone = 'neutral' | 'positive' | 'warning';

interface StatusCardProps {
  title: string;
  value: string;
  description: string;
  tone?: StatusTone;
  icon?: ReactNode;
  footnote?: string;
}

const toneCardClasses: Record<StatusTone, string> = {
  neutral: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  positive: 'border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30',
  warning: 'border-amber-200 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
};

const toneValueClasses: Record<StatusTone, string> = {
  neutral: 'text-slate-900 dark:text-slate-100',
  positive: 'text-emerald-900 dark:text-emerald-100',
  warning: 'text-amber-900 dark:text-amber-100'
};

const toneIconClasses: Record<StatusTone, string> = {
  neutral: 'text-slate-500 dark:text-slate-400',
  positive: 'text-emerald-700 dark:text-emerald-200',
  warning: 'text-amber-700 dark:text-amber-200'
};

const toneDescriptionClasses: Record<StatusTone, string> = {
  neutral: 'text-slate-600 dark:text-slate-300',
  positive: 'text-emerald-900 dark:text-emerald-100',
  warning: 'text-amber-900 dark:text-amber-100'
};

const toneFootnoteClasses: Record<StatusTone, string> = {
  neutral: 'text-slate-500 dark:text-slate-400',
  positive: 'text-emerald-800/90 dark:text-emerald-200/80',
  warning: 'text-amber-800/90 dark:text-amber-100/80'
};

export function StatusCard({ title, value, description, tone = 'neutral', icon, footnote }: StatusCardProps) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const headingId = `status-card-${slug}`;
  const descriptionId = `status-card-${slug}-description`;
  const footnoteId = footnote ? `status-card-${slug}-footnote` : undefined;
  const describedBy = footnoteId ? `${descriptionId} ${footnoteId}` : descriptionId;

  return (
    <Card
      role="status"
      aria-labelledby={headingId}
      aria-describedby={describedBy}
      className={cn('flex h-full flex-col justify-between shadow-sm transition-colors', toneCardClasses[tone])}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-5 pb-0">
        <div>
          <CardDescription
            id={headingId}
            className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            {title}
          </CardDescription>
          <CardTitle className={cn('mt-2 text-3xl font-semibold leading-tight', toneValueClasses[tone])}>
            {value}
          </CardTitle>
        </div>
        {icon ? (
          <span aria-hidden="true" className={cn('mt-1', toneIconClasses[tone])}>
            {icon}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        <p id={descriptionId} className={cn('text-sm leading-relaxed', toneDescriptionClasses[tone])}>
          {description}
        </p>
      </CardContent>
      {footnote ? (
        <CardFooter className="px-5 pb-5 pt-0">
          <p id={footnoteId} className={cn('text-xs leading-snug', toneFootnoteClasses[tone])}>
            {footnote}
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
