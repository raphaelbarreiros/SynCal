'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  ConnectorResponse,
  ConnectorValidationResult,
  HtmlIcsConnectorConfig,
  OAuthContextEntry,
  OAuthProvider,
  PrivacyMode,
  ValidationIssue
} from '@syncal/core';

import { deriveConnectorSubmissionFeedback } from './submission-feedback';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export type Connector = ConnectorResponse;

type ProviderDefinition = {
  id: OAuthProvider;
  name: string;
  description: string;
  scopes: string[];
};

type HtmlWizardForm = {
  feedUrl: string;
  authHeader: string;
  authToken: string;
  targetCalendarLabel: string;
  displayName: string;
};

type HtmlWizardErrors = Partial<
  Record<'feedUrl' | 'authHeader' | 'authToken' | 'targetCalendarLabel', string>
>;

function buildHtmlConfig(form: HtmlWizardForm): HtmlIcsConnectorConfig {
  const trimmedHeader = form.authHeader.trim();
  const trimmedToken = form.authToken.trim();

  return {
    feedUrl: form.feedUrl.trim(),
    targetCalendarLabel: form.targetCalendarLabel.trim(),
    ...(trimmedHeader && trimmedToken
      ? {
          authHeader: trimmedHeader,
          authToken: trimmedToken
        }
      : {})
  } satisfies HtmlIcsConnectorConfig;
}

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

const HTML_WIZARD_INITIAL: HtmlWizardForm = {
  feedUrl: '',
  authHeader: '',
  authToken: '',
  targetCalendarLabel: '',
  displayName: ''
};

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
  const [isHtmlWizardActive, setIsHtmlWizardActive] = useState(false);
  const [htmlForm, setHtmlForm] = useState<HtmlWizardForm>(HTML_WIZARD_INITIAL);
  const [htmlFormErrors, setHtmlFormErrors] = useState<HtmlWizardErrors>({});
  const [isTestingHtml, setIsTestingHtml] = useState(false);
  const [htmlValidationResult, setHtmlValidationResult] =
    useState<ConnectorValidationResult | null>(null);
  const [htmlValidationIssues, setHtmlValidationIssues] = useState<ValidationIssue[]>([]);
  const [htmlWizardError, setHtmlWizardError] = useState<string | null>(null);

  const resetHtmlWizard = useCallback(() => {
    setHtmlForm(HTML_WIZARD_INITIAL);
    setHtmlFormErrors({});
    setHtmlValidationResult(null);
    setHtmlValidationIssues([]);
    setHtmlWizardError(null);
    setIsTestingHtml(false);
  }, []);

  const validateHtmlForm = useCallback((form: HtmlWizardForm): HtmlWizardErrors => {
    const errors: HtmlWizardErrors = {};

    if (!form.feedUrl.trim()) {
      errors.feedUrl = 'Feed URL is required.';
    } else {
      try {
        const url = new URL(form.feedUrl.trim());
        if (url.protocol !== 'https:') {
          errors.feedUrl = 'Feed URL must use HTTPS.';
        }
      } catch {
        errors.feedUrl = 'Enter a valid HTTPS URL.';
      }
    }

    if (form.authHeader.trim() && !form.authToken.trim()) {
      errors.authToken = 'Provide a token when using a custom header.';
    }

    if (form.authToken.trim() && !form.authHeader.trim()) {
      errors.authHeader = 'Provide a header name when supplying a token.';
    }

    if (!form.targetCalendarLabel.trim()) {
      errors.targetCalendarLabel = 'Target calendar label is required.';
    }

    return errors;
  }, []);

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
    if (isHtmlWizardActive) {
      return;
    }

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
  }, [activeContextEntry, isHtmlWizardActive]);

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

  const updateHtmlForm = useCallback((field: keyof HtmlWizardForm, value: string) => {
    setHtmlForm((prev) => ({
      ...prev,
      [field]: value
    }));
    setHtmlFormErrors((prev) => ({
      ...prev,
      [field]: undefined
    }));
    setHtmlWizardError(null);
    setHtmlValidationResult(null);
    setHtmlValidationIssues([]);
  }, []);

  const openHtmlWizard = useCallback(() => {
    setPageError(null);
    setActionMessage(null);
    resetHtmlWizard();
    setIsHtmlWizardActive(true);
  }, [resetHtmlWizard]);

  const closeHtmlWizard = useCallback(() => {
    resetHtmlWizard();
    setIsHtmlWizardActive(false);
  }, [resetHtmlWizard]);

  const reopenHtmlWizardForConnector = useCallback(
    (connector: Connector) => {
      setPageError(null);
      setActionMessage(null);
      resetHtmlWizard();
      setHtmlForm((prev) => ({
        ...prev,
        targetCalendarLabel: connector.targetCalendarLabel ?? '',
        displayName: connector.displayName ?? connector.targetCalendarLabel ?? ''
      }));
      setIsHtmlWizardActive(true);
    },
    [resetHtmlWizard]
  );

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
      await loadConnectors();
      await loadContext();

      const { successMessage, errorMessage } = deriveConnectorSubmissionFeedback(created);

      if (errorMessage) {
        setActionMessage(null);
        setPageError(errorMessage);
        return;
      }

      setPageError(null);
      setActionMessage(successMessage ?? null);
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

  const testHtmlFeed = useCallback(async () => {
    const validationErrors = validateHtmlForm(htmlForm);
    if (Object.keys(validationErrors).length > 0) {
      setHtmlFormErrors(validationErrors);
      return;
    }

    try {
      setIsTestingHtml(true);
      setHtmlWizardError(null);
      const token = await ensureCsrf();
      const response = await fetch(`${API_BASE_URL}/connectors/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          type: 'html_ics',
          config: buildHtmlConfig(htmlForm)
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? 'Failed to validate feed');
      }

      const payload = (await response.json()) as ConnectorValidationResult;
      setHtmlValidationIssues(payload.issues ?? []);

      if (payload.status === 'ok') {
        setHtmlValidationResult(payload);
        setHtmlWizardError(null);
      } else {
        setHtmlValidationResult(null);
        setHtmlWizardError(
          payload.issues?.[0]?.message ?? 'Validation failed. Check the feed details and retry.'
        );
      }
    } catch (error) {
      setHtmlValidationResult(null);
      setHtmlValidationIssues([]);
      setHtmlWizardError(
        error instanceof Error
          ? error.message
          : 'Unexpected error while testing the feed. Please retry.'
      );
    } finally {
      setIsTestingHtml(false);
    }
  }, [ensureCsrf, htmlForm, validateHtmlForm]);

  const submitHtmlConnector = useCallback(async () => {
    const validationErrors = validateHtmlForm(htmlForm);
    if (Object.keys(validationErrors).length > 0) {
      setHtmlFormErrors(validationErrors);
      return;
    }

    if (!htmlValidationResult || htmlValidationResult.status !== 'ok') {
      setHtmlWizardError('Test the feed and resolve any issues before saving.');
      return;
    }

    try {
      setIsSubmitting(true);
      setHtmlWizardError(null);
      const token = await ensureCsrf();
      const payload = {
        type: 'html_ics' as const,
        displayName:
          htmlForm.displayName.trim() || htmlForm.targetCalendarLabel.trim() || undefined,
        config: buildHtmlConfig(htmlForm)
      } satisfies {
        type: 'html_ics';
        displayName?: string;
        config: HtmlIcsConnectorConfig;
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
      await loadConnectors();
      await loadContext();

      const feedback = deriveConnectorSubmissionFeedback(created);

      if (feedback.errorMessage) {
        setActionMessage(null);
        setPageError(feedback.errorMessage);
      } else if (feedback.successMessage) {
        setPageError(null);
        setActionMessage(feedback.successMessage);
      } else {
        setPageError(null);
        setActionMessage('Connector saved successfully.');
      }

      closeHtmlWizard();
    } catch (error) {
      setHtmlWizardError(
        error instanceof Error ? error.message : 'Failed to save connector. Please retry.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    closeHtmlWizard,
    ensureCsrf,
    htmlForm,
    htmlValidationResult,
    loadConnectors,
    loadContext,
    setActionMessage,
    setPageError,
    validateHtmlForm
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
      <article className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900/70">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          HTML / ICS feed
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Link a read-only calendar feed using an HTTPS URL. Optional auth headers let you access
          protected feeds.
        </p>
        <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <li className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
            Test the feed before saving to preview upcoming events.
          </li>
          <li className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
            SynCal stores the raw URL and secrets encrypted for worker jobs.
          </li>
        </ul>
        <button
          type="button"
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onClick={openHtmlWizard}
        >
          Connect HTML / ICS feed
        </button>
      </article>
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

  const wizardDescription = isHtmlWizardActive
    ? 'Provide feed details, test the connection, and save.'
    : activeContextEntry
        ? 'Step 2 of 2 – choose calendars and confirm.'
        : 'Step 1 of 2 – pick a provider to begin.';

  const wizardContent = isHtmlWizardActive
    ? (
        <HtmlIcsWizard
          form={htmlForm}
          errors={htmlFormErrors}
          onChange={updateHtmlForm}
          onBack={closeHtmlWizard}
          onTest={testHtmlFeed}
          onSubmit={submitHtmlConnector}
          isTesting={isTestingHtml}
          isSubmitting={isSubmitting}
          validationResult={htmlValidationResult}
          validationIssues={htmlValidationIssues}
          errorMessage={htmlWizardError}
        />
      )
    : activeContextEntry
        ? renderCalendarSelection()
        : renderProviderCards();

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
            <p className="text-sm text-slate-600 dark:text-slate-300">{wizardDescription}</p>
          </div>
          {isHtmlWizardActive ? (
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
              onClick={closeHtmlWizard}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {wizardContent}
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
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Last fetch</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {connectors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
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
                      {connector.type === 'html_ics'
                        ? connector.lastSuccessfulFetchAt
                          ? new Date(connector.lastSuccessfulFetchAt).toLocaleString()
                          : 'Not fetched yet'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {connector.type === 'html_ics' ? (
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-slate-600 dark:text-slate-300">
                            {connector.maskedUrl ?? '—'}
                          </p>
                          {connector.previewEvents?.length ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {connector.previewEvents.length}{' '}
                              previewed event{connector.previewEvents.length === 1 ? '' : 's'}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Preview will appear after validation.
                            </p>
                          )}
                          {connector.targetCalendarLabel ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Label: {connector.targetCalendarLabel}
                            </p>
                          ) : null}
                          {connector.validationIssues && connector.validationIssues.length > 0 ? (
                            <div className="mt-2 space-y-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-200">
                              <p className="font-semibold uppercase tracking-wide">Validation issues</p>
                              <ul className="space-y-1">
                                {connector.validationIssues.map((issue) => (
                                  <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/40"
                                onClick={() => reopenHtmlWizardForConnector(connector)}
                              >
                                Retest feed
                              </button>
                            </div>
                          ) : connector.status === 'pending_validation' ? (
                            <div className="mt-2 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200">
                              <p className="font-semibold uppercase tracking-wide">Validation pending</p>
                              <p>
                                Test the feed again and resolve any reported issues before enabling this connector.
                              </p>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-md border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-amber-500 dark:text-amber-200 dark:hover:bg-amber-900/40"
                                onClick={() => reopenHtmlWizardForConnector(connector)}
                              >
                                Retest feed
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span>{connector.calendars.length}</span>
                      )}
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

interface HtmlIcsWizardProps {
  form: HtmlWizardForm;
  errors: HtmlWizardErrors;
  onChange: (field: keyof HtmlWizardForm, value: string) => void;
  onBack: () => void;
  onTest: () => void;
  onSubmit: () => void;
  isTesting: boolean;
  isSubmitting: boolean;
  validationResult: ConnectorValidationResult | null;
  validationIssues: ValidationIssue[];
  errorMessage: string | null;
}

function HtmlIcsWizard({
  form,
  errors,
  onChange,
  onBack,
  onTest,
  onSubmit,
  isTesting,
  isSubmitting,
  validationResult,
  validationIssues,
  errorMessage
}: HtmlIcsWizardProps) {
  const previewEvents = validationResult?.previewEvents ?? [];
  const canSubmit = validationResult?.status === 'ok' && !isTesting && !isSubmitting;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Feed details</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Provide the feed URL and optional authentication details. Feeds must use HTTPS and return
          iCalendar data.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Feed URL
            <input
              type="url"
              value={form.feedUrl}
              onChange={(event) => onChange('feedUrl', event.target.value)}
              placeholder="https://calendar.example.com/feed.ics"
              className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:bg-slate-900 dark:text-slate-100 ${errors.feedUrl ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
              aria-invalid={Boolean(errors.feedUrl)}
            />
            {errors.feedUrl ? (
              <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.feedUrl}</span>
            ) : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Auth header (optional)
              <input
                type="text"
                value={form.authHeader}
                onChange={(event) => onChange('authHeader', event.target.value)}
                placeholder="Authorization"
                className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:bg-slate-900 dark:text-slate-100 ${errors.authHeader ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
                aria-invalid={Boolean(errors.authHeader)}
              />
              {errors.authHeader ? (
                <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.authHeader}</span>
              ) : null}
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Auth token (optional)
              <input
                type="password"
                value={form.authToken}
                onChange={(event) => onChange('authToken', event.target.value)}
                placeholder="Bearer <token>"
                className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:bg-slate-900 dark:text-slate-100 ${errors.authToken ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
                aria-invalid={Boolean(errors.authToken)}
              />
              {errors.authToken ? (
                <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.authToken}</span>
              ) : null}
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Target calendar label
            <input
              type="text"
              value={form.targetCalendarLabel}
              onChange={(event) => onChange('targetCalendarLabel', event.target.value)}
              placeholder="e.g. Ops Calendar"
              className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:bg-slate-900 dark:text-slate-100 ${errors.targetCalendarLabel ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
              aria-invalid={Boolean(errors.targetCalendarLabel)}
            />
            {errors.targetCalendarLabel ? (
              <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                {errors.targetCalendarLabel}
              </span>
            ) : null}
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Display name (optional)
            <input
              type="text"
              value={form.displayName}
              onChange={(event) => onChange('displayName', event.target.value)}
              placeholder="Overrides the target label if provided"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </div>

      {validationResult?.status === 'ok' ? (
        <div className="rounded-2xl border border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          Feed validated successfully. {previewEvents.length > 0 ? `${previewEvents.length} upcoming event${previewEvents.length === 1 ? '' : 's'} detected.` : 'No upcoming events were found.'}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-400 bg-red-50 p-4 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/40 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {validationIssues.length > 0 ? (
        <div className="space-y-2">
          {validationIssues.map((issue) => (
            <div
              key={`${issue.code}-${issue.message}`}
              className={`rounded-2xl border p-3 text-sm ${
                issue.severity === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200'
                  : issue.severity === 'info'
                    ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200'
                    : 'border-red-300 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-200'
              }`}
            >
              <p className="font-medium">{issue.code}</p>
              <p className="mt-1 text-xs leading-5">{issue.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      {previewEvents.length > 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Upcoming preview events
          </h4>
          <ul className="mt-4 space-y-3">
            {previewEvents.map((event) => (
              <li
                key={event.uid}
                className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {event.summary ?? 'Untitled event'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {new Date(event.startsAt).toLocaleString()}{' '}
                  {event.allDay ? '(all day)' : ''}
                </p>
                {event.endsAt ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ends {new Date(event.endsAt).toLocaleString()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600 dark:text-slate-300"
          onClick={onBack}
          disabled={isTesting}
        >
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600 dark:text-slate-300"
            onClick={onTest}
            disabled={isTesting || isSubmitting}
          >
            {isTesting ? 'Testing…' : 'Test feed'}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Save connector'}
          </button>
        </div>
      </div>
    </div>
  );
}
