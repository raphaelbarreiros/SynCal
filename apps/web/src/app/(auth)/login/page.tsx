import { Suspense } from 'react';
import LoginForm from '../../../components/login-form';

export const metadata = {
  title: 'SynCal Admin Login'
};

export default function LoginPage() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900/60 p-8 shadow-lg">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Sign in to SynCal</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter your administrator credentials to manage connectors and calendars.
          </p>
        </header>
        <Suspense
          fallback={
            <p className="text-center text-sm text-slate-400" role="status">
              Preparing secure login…
            </p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
