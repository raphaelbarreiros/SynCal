'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

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

interface LogoutButtonProps {
  className?: string;
  buttonClassName?: string;
  label?: string;
}

export default function LogoutButton({
  className,
  buttonClassName,
  label = 'Sign out'
}: LogoutButtonProps) {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshToken = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await requestCsrfToken();
      setCsrfToken(token);
      setErrorMessage(null);
    } catch (error) {
      setCsrfToken(null);
      setErrorMessage('Unable to prepare logout. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshToken();
  }, [refreshToken]);

  const handleSignOut = useCallback(async () => {
    if (!csrfToken) {
      setErrorMessage('Security token missing. Please refresh and try again.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });

      if (response.status === 204) {
        if (typeof window !== 'undefined') {
          window.location.assign('/login');
          return;
        }

        router.replace('/login');
        router.refresh();
        return;
      }

      setErrorMessage('Failed to sign out. Please try again.');
      await refreshToken();
    } catch (error) {
      setErrorMessage('Failed to sign out. Please try again.');
      await refreshToken();
    } finally {
      setIsLoading(false);
    }
  }, [csrfToken, refreshToken, router]);

  const containerClassName = className ? `${className}` : 'space-y-3';

  const baseButtonClasses =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed';
  const variantButtonClasses =
    buttonClassName ??
    'bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:bg-slate-800/60 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-50';

  return (
    <div className={containerClassName || undefined}>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-400">
          {errorMessage}
        </p>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isLoading}
        aria-busy={isLoading}
        data-state={isLoading ? 'loading' : 'idle'}
        className={`${baseButtonClasses} ${variantButtonClasses}`}
      >
        {label}
      </button>
    </div>
  );
}
