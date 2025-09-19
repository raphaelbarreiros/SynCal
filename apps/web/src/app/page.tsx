import LogoutButton from '../components/logout-button';

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
        <header>
          <h1 className="text-3xl font-semibold">SynCal Portal</h1>
          <p className="mt-2 text-slate-400">
            You are signed in as an administrator. Use the navigation (coming soon) to manage connectors, calendars, and sync jobs.
          </p>
        </header>
        <LogoutButton />
      </section>
    </main>
  );
}
