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

export default function LogoutButton() {
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

  return (
    <div className="space-y-3">
      {errorMessage && (
        <p role="alert" className="text-sm text-red-400">
          {errorMessage}
        </p>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isLoading}
        className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/60"
      >
        {isLoading ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
