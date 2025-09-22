import type { Metadata } from 'next';
import '../styles/globals.css';
import { AppShell } from '../components/app-shell';
import { ThemeProvider } from '@syncal/ui';

export const metadata: Metadata = {
  title: 'SynCal Administration Portal',
  description: 'Monitor connectors, calendars, and synchronization status for SynCal.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
