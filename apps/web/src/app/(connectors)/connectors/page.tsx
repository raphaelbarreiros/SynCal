'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

type OAuthProvider = 'google' | 'microsoft';

type PrivacyMode = 'original_title' | 'busy_placeholder';

type ConnectorStatus = 'pending_validation' | 'validated' | 'disabled';

type ValidationStatus = 'pending' | 'success' | 'error';

type ConnectorCalendar = {
  id: string;
  providerCalendarId: string;
  displayName: string | null;
  privacyMode: PrivacyMode;
};

type Connector = {
  id: string;
  type: OAuthProvider;
  displayName: string | null;
  status: ConnectorStatus;
  lastValidatedAt: string | null;
  calendars: ConnectorCalendar[];
  config?: {
    validation?: {
      status: ValidationStatus;
      checkedAt?: string;
      samples?: Array<{ calendarId: string; total: number; from: string; to: string }>;
      error?: string;
    };
  };
  createdAt: string;
};

type DiscoveredCalendar = {
  id: string;
  name: string;
  description?: string;
  timeZone?: string;
  isPrimary: boolean;
  canEdit: boolean;
};

type OAuthContextEntry = {
  provider: OAuthProvider;
  state: string;
  profile?: {
    id: string;
    email?: string;
    name?: string;
  };
  scopes?: string[];
  discoveredCalendars: DiscoveredCalendar[];
};

type ProviderDefinition = {
  id: OAuthProvider;
  name: string;
  description: string;
  scopes: string[];
};

const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'google',
    name: 'Google Workspace Calendar',
    description:
      'Request offline access to manage calendars and events on behalf of your Google Workspace tenant.',
    scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar']
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365 Calendar',
    description:
      'Authorize Microsoft Graph to sync calendars and busy events for Office 365 or Azure AD users.',
    scopes: ['openid', 'email', 'profile', 'offline_access', 'Calendars.ReadWrite']
  }
];

interface SelectionState {
  displayName?: string;
  privacyMode: PrivacyMode;
}

async function fetchCsrfToken(): Promise<string> {
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

async function fetchConnectors(): Promise<Connector[]> {
  const response = await fetch(`${API_BASE_URL}/connectors`, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Failed to load connectors');
  }

  const payload = (await response.json()) as { connectors: Connector[] };
  return payload.connectors;
}

async function fetchOAuthContext(): Promise<OAuthContextEntry[]> {
  const response = await fetch(`${API_BASE_URL}/auth/oauth/context`, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Failed to load OAuth context');
  }

  const payload = (await response.json()) as { entries: OAuthContextEntry[] };
  return payload.entries;
}

export default function ConnectorsPage() {
  return (
    <Suspense fallback={<ConnectorWizardSkeleton />}>
      <ConnectorsContent />
    </Suspense>
  );
}

function ConnectorWizardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function ConnectorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [contextEntries, setContextEntries] = useState<OAuthContextEntry[]>([]);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectionState, setSelectionState] = useState<Record<string, SelectionState>>({});
  const [displayName, setDisplayName] = useState('');

  const providerParam = searchParams.get('provider');
  const statusParam = searchParams.get('status');
  const stateParam = searchParams.get('state');

  const activeProvider: OAuthProvider | null = useMemo(() => {
    if (providerParam === 'google' || providerParam === 'microsoft') {
      return providerParam;
    }
    return null;
  }, [providerParam]);

  const activeContextEntry = useMemo(() => {
    if (!activeProvider) {
      return null;
    }

    if (!stateParam) {
      return contextEntries.find((entry) => entry.provider === activeProvider) ?? null;
    }

    return (
      contextEntries.find(
        (entry) => entry.provider === activeProvider && entry.state === stateParam
      ) ?? null
    );
  }, [activeProvider, stateParam, contextEntries]);

  const selectedCalendarIds = useMemo(
    () => Object.entries(selectionState).filter(([_, value]) => Boolean(value)).map(([id]) => id),
    [selectionState]
  );

  const loadCsrf = useCallback(async () => {
    try {
      const token = await fetchCsrfToken();
      setCsrfToken(token);
      return token;
    } catch (error) {
      setPageError('Unable to prepare secure session tokens. Refresh the page and try again.');
      throw error;
    }
  }, []);

  const loadConnectors = useCallback(async () => {
    try {
      setIsLoadingConnectors(true);
      const data = await fetchConnectors();
      setConnectors(data);
    } catch (error) {
      setPageError('Failed to load connectors. Please refresh the page.');
    } finally {
      setIsLoadingConnectors(false);
    }
  }, []);

  const loadContext = useCallback(async () => {
    try {
      const entries = await fetchOAuthContext();
      setContextEntries(entries);
    } catch (error) {
      setPageError('Unable to load connector context.');
    }
  }, []);

  useEffect(() => {
    void loadConnectors();
    void loadContext();
    void loadCsrf();
  }, [loadConnectors, loadContext, loadCsrf]);

  useEffect(() => {
    if (statusParam === 'error') {
      setPageError('Authorization was cancelled or failed. Please try again.');
    }
  }, [statusParam]);

  useEffect(() => {
    if (activeContextEntry) {
      const defaults: Record<string, SelectionState> = {};
      for (const calendar of activeContextEntry.discoveredCalendars) {
        defaults[calendar.id] = {
          privacyMode: 'busy_placeholder'
        };
      }
      setSelectionState(defaults);
    } else {
      setSelectionState({});
      setDisplayName('');
    }
  }, [activeContextEntry]);

  const ensureCsrf = useCallback(async () => {
    if (csrfToken) {
      return csrfToken;
    }

    return loadCsrf();
  }, [csrfToken, loadCsrf]);

  const beginOAuth = useCallback(
    async (provider: OAuthProvider) => {
      try {
        setPageError(null);
        setActionMessage(null);
        const token = await ensureCsrf();
        const response = await fetch(`${API_BASE_URL}/auth/oauth/start`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token
          },
          body: JSON.stringify({ provider })
        });

        if (!response.ok) {
          throw new Error('Failed to prepare authorization flow');
        }

        const payload = (await response.json()) as {
          authorizationUrl: string;
          state: string;
        };

        if (typeof window !== 'undefined') {
          window.location.assign(payload.authorizationUrl);
        }
      } catch (error) {
        setPageError('Unable to start authorization. Please try again.');
      }
    },
    [ensureCsrf]
  );

  const toggleCalendar = useCallback((calendarId: string) => {
    setSelectionState((prev) => {
      const next = { ...prev };
      if (next[calendarId]) {
        delete next[calendarId];
      } else {
        next[calendarId] = { privacyMode: 'busy_placeholder' };
      }
      return next;
    });
  }, []);

  const setPrivacyMode = useCallback((calendarId: string, mode: PrivacyMode) => {
    setSelectionState((prev) => ({
      ...prev,
      [calendarId]: {
        ...(prev[calendarId] ?? { privacyMode: mode }),
        privacyMode: mode
      }
    }));
  }, []);

  const setCalendarDisplayName = useCallback((calendarId: string, value: string) => {
    setSelectionState((prev) => ({
      ...prev,
      [calendarId]: {
        ...(prev[calendarId] ?? { privacyMode: 'busy_placeholder' }),
        displayName: value
      }
    }));
  }, []);

  const submitConnector = useCallback(async () => {
    if (!activeProvider || !activeContextEntry) {
      return;
    }

    if (selectedCalendarIds.length === 0) {
      setPageError('Select at least one calendar before continuing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setPageError(null);
      const token = await ensureCsrf();

      const payload = {
        type: activeProvider,
        state: activeContextEntry.state,
        displayName: displayName.trim() || undefined,
        selectedCalendars: selectedCalendarIds.map((id) => ({
          providerCalendarId: id,
          displayName: selectionState[id]?.displayName?.trim() || undefined,
          privacyMode: selectionState[id]?.privacyMode ?? 'busy_placeholder'
        }))
      } satisfies {
        type: OAuthProvider;
        state: string;
        displayName?: string;
        selectedCalendars: Array<{ providerCalendarId: string; displayName?: string; privacyMode: PrivacyMode }>;
      };

      const response = await fetch(`${API_BASE_URL}/connectors`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? 'Failed to create connector');
      }

      const created = (await response.json()) as Connector;
      setActionMessage(`Connector ${created.displayName ?? created.type} is ready.`);
      await loadConnectors();
      await loadContext();
      setDisplayName('');
      setSelectionState({});
      router.replace('/connectors');
      router.refresh();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to complete connector setup. Please retry.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeProvider,
    activeContextEntry,
    displayName,
    ensureCsrf,
    loadConnectors,
    loadContext,
    router,
    selectedCalendarIds,
    selectionState
  ]);

  const renderProviderCards = () => (
    <div className="grid gap-4 md:grid-cols-2">
      {PROVIDERS.map((provider) => (
        <article
          key={provider.id}
          className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900/70"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {provider.name}
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{provider.description}</p>
          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-semibold uppercase tracking-wide">Scopes requested</p>
            <ul className="mt-1 space-y-1">
              {provider.scopes.map((scope) => (
                <li key={scope} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
                  {scope}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            onClick={() => beginOAuth(provider.id)}
          >
            Connect {provider.id === 'google' ? 'Google' : 'Microsoft'}
          </button>
        </article>
      ))}
    </div>
  );

  const renderCalendarSelection = () => {
    if (!activeProvider || !activeContextEntry) {
      return null;
    }

    const profileName = activeContextEntry.profile?.name ?? activeContextEntry.profile?.email;

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Select calendars to sync
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {profileName
              ? `Calendars available for ${profileName}. Choose at least one calendar to continue.`
              : 'Choose one or more calendars discovered for this connector.'}
          </p>

          <div className="mt-4 space-y-4">
            {activeContextEntry.discoveredCalendars.map((calendar) => {
              const isSelected = Boolean(selectionState[calendar.id]);
              const privacyMode = selectionState[calendar.id]?.privacyMode ?? 'busy_placeholder';
              const nickname = selectionState[calendar.id]?.displayName ?? '';

              return (
                <div
                  key={calendar.id}
                  className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCalendar(calendar.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="font-medium">{calendar.name}</span>
                        {calendar.isPrimary ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Primary
                          </span>
                        ) : null}
                      </label>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {calendar.description ?? 'No description provided.'}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Time zone: {calendar.timeZone ?? 'Provider default'}
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Display name (optional)
                        <input
                          type="text"
                          value={nickname}
                          onChange={(event) => setCalendarDisplayName(calendar.id, event.target.value)}
                          placeholder="e.g. EMEA Marketing Ops"
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Privacy mode
                        <select
                          value={privacyMode}
                          onChange={(event) =>
                            setPrivacyMode(calendar.id, event.target.value as PrivacyMode)
                          }
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="busy_placeholder">Busy (recommended)</option>
                          <option value="original_title">Original title</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Review</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Provide an optional display name for this connector to make it easier to reference later.
          </p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Connector display name
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Marketing Google Workspace"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {selectedCalendarIds.length} calendar(s) selected.
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-200"
                onClick={() => {
                  router.replace('/connectors');
                  router.refresh();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitConnector}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {isSubmitting ? 'Connecting…' : 'Complete setup'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Connectors</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Authorize Google Workspace and Microsoft 365 calendars, select which surfaces to sync, and
          confirm validation before pairing calendars.
        </p>
      </header>

      {pageError ? (
        <div className="rounded-2xl border border-red-400 bg-red-50 p-4 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/40 dark:text-red-200">
          {pageError}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-2xl border border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200">
          {actionMessage}
        </div>
      ) : null}

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Connector wizard</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {activeContextEntry ? 'Step 2 of 2 – choose calendars and confirm.' : 'Step 1 of 2 – pick a provider to begin.'}
            </p>
          </div>
        </div>

        {!activeContextEntry ? renderProviderCards() : renderCalendarSelection()}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Connected providers</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Review connector health, validation status, and linked calendars.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Provider</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Display name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Last validated</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Calendars</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {connectors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {isLoadingConnectors ? 'Loading connectors…' : 'No connectors have been configured yet.'}
                  </td>
                </tr>
              ) : (
                connectors.map((connector) => (
                  <tr key={connector.id} className="bg-white/70 dark:bg-slate-900/60">
                    <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-200">
                      {connector.type}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {connector.displayName ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          connector.status === 'validated'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : connector.status === 'pending_validation'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {connector.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {connector.lastValidatedAt
                        ? new Date(connector.lastValidatedAt).toLocaleString()
                        : 'Pending'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {connector.calendars.length}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
