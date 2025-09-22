'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface StatusMessage {
  type: 'error' | 'success';
  message: string;
}

async function requestCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Unable to fetch CSRF token');
  }

  const payload = (await response.json()) as { token: string };
  return payload.token;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const loadCsrfToken = useCallback(async () => {
    try {
      setIsLoadingToken(true);
      const token = await requestCsrfToken();
      setCsrfToken(token);
      return token;
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: 'Unable to prepare the login form. Please refresh and try again.'
      });
      setCsrfToken(null);
      return null;
    } finally {
      setIsLoadingToken(false);
    }
  }, []);

  useEffect(() => {
    void loadCsrfToken();
  }, [loadCsrfToken]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      let token = csrfToken;

      if (!token) {
        token = await loadCsrfToken();
      }

      if (!token) {
        setStatusMessage({
          type: 'error',
          message: 'Security token missing. Please refresh the page and try again.'
        });
        return;
      }

      if (!email.trim() || !password.trim()) {
        setStatusMessage({
          type: 'error',
          message: 'Email and password are required.'
        });
        return;
      }

      setIsSubmitting(true);
      setStatusMessage(null);

      const normalizedEmail = email.trim().toLowerCase();

      try {
        const response = await fetch(`${API_BASE_URL}/auth/session`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token
          },
          body: JSON.stringify({ email: normalizedEmail, password })
        });

        if (response.status === 204) {
          const requestedRedirect = searchParams.get('from');
          const redirectTo = requestedRedirect && requestedRedirect.startsWith('/') ? requestedRedirect : '/';
          try {
            router.replace(redirectTo);
            router.refresh();
          } catch (error) {
            if (typeof window !== 'undefined') {
              window.location.href = redirectTo;
            }
          }
          return;
        }

        if (response.status === 401) {
          setStatusMessage({
            type: 'error',
            message: 'Invalid email or password.'
          });
        } else if (response.status === 400) {
          setStatusMessage({
            type: 'error',
            message: 'Please check your email format and password length.'
          });
        } else {
          setStatusMessage({
            type: 'error',
            message: 'Unexpected error during sign in. Please try again.'
          });
        }

        await loadCsrfToken();
      } catch (error) {
        setStatusMessage({
          type: 'error',
          message: 'Unable to reach the authentication service. Please try again.'
        });
        await loadCsrfToken();
      } finally {
        setIsSubmitting(false);
        setPassword('');
      }
    },
    [csrfToken, email, loadCsrfToken, password, router, searchParams]
  );

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
          disabled={isSubmitting}
        />
      </div>

      {statusMessage && (
        <p
          role="alert"
          className={`text-sm ${statusMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {statusMessage.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || isLoadingToken}
        className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
      >
        {isSubmitting ? 'Signing in…' : isLoadingToken ? 'Preparing…' : 'Sign in'}
      </button>
    </form>
  );
}
