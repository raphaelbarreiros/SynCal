'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncal/ui';
import type { OAuthProviderCalendar } from '../../lib/api-client';
import { fetchCsrfToken, initiateOAuth, createConnector } from '../../lib/api-client';

interface ConnectorWizardProps {
  onConnectorCreated?: (connectorId: string) => void;
  onCancel?: () => void;
}

type WizardStep = 'provider-selection' | 'oauth-pending' | 'calendar-selection' | 'creating' | 'success' | 'error';

interface WizardState {
  step: WizardStep;
  provider: 'google' | 'microsoft' | null;
  calendars: OAuthProviderCalendar[];
  selectedCalendars: string[];
  displayName: string;
  csrfToken: string | null;
  error: string | null;
  createdConnectorId: string | null;
}

export default function ConnectorWizard({ onConnectorCreated, onCancel }: ConnectorWizardProps) {
  const [state, setState] = useState<WizardState>({
    step: 'provider-selection',
    provider: null,
    calendars: [],
    selectedCalendars: [],
    displayName: '',
    csrfToken: null,
    error: null,
    createdConnectorId: null,
  });

  // Load CSRF token on mount
  const loadCsrfToken = useCallback(async () => {
    try {
      const token = await fetchCsrfToken();
      setState(prev => ({ ...prev, csrfToken: token }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        step: 'error', 
        error: 'Failed to initialize wizard. Please refresh and try again.' 
      }));
    }
  }, []);

  useEffect(() => {
    void loadCsrfToken();
  }, [loadCsrfToken]);

  // Check for OAuth callback success/error in URL params and load calendar data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const calendarsCount = urlParams.get('calendars');

    if (success === 'google' || success === 'microsoft') {
      // Simulate calendar data - in a real app, this would come from the session
      // For now, we'll create mock calendar data to demonstrate the flow
      const mockCalendars: OAuthProviderCalendar[] = [
        {
          id: 'primary',
          summary: success === 'google' ? 'Primary Calendar' : 'Calendar',
          description: 'Your main calendar',
          primary: true,
          accessRole: 'owner'
        },
        {
          id: 'work',
          summary: success === 'google' ? 'Work' : 'Work Calendar',
          description: 'Work-related events',
          primary: false,
          accessRole: 'owner'
        },
        {
          id: 'personal',
          summary: 'Personal',
          description: 'Personal events',
          primary: false,
          accessRole: 'owner'
        }
      ];

      setState(prev => ({ 
        ...prev, 
        provider: success as 'google' | 'microsoft',
        step: 'calendar-selection',
        calendars: mockCalendars
      }));
      
      // Clean up URL params
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } else if (error) {
      setState(prev => ({ 
        ...prev, 
        step: 'error', 
        error: decodeURIComponent(error) 
      }));
      
      // Clean up URL params  
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  const handleProviderSelect = async (provider: 'google' | 'microsoft') => {
    if (!state.csrfToken) {
      setState(prev => ({ ...prev, error: 'Security token not ready. Please try again.' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, provider, step: 'oauth-pending', error: null }));
      
      const oauthResponse = await initiateOAuth(provider, state.csrfToken);
      
      // Redirect to provider's OAuth page
      window.location.href = oauthResponse.authUrl;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        step: 'error', 
        error: error instanceof Error ? error.message : 'Failed to start OAuth flow' 
      }));
    }
  };

  const handleCalendarToggle = (calendarId: string) => {
    setState(prev => ({
      ...prev,
      selectedCalendars: prev.selectedCalendars.includes(calendarId)
        ? prev.selectedCalendars.filter(id => id !== calendarId)
        : [...prev.selectedCalendars, calendarId]
    }));
  };

  const handleCreateConnector = async () => {
    if (!state.provider || !state.csrfToken || state.selectedCalendars.length === 0) {
      return;
    }

    try {
      setState(prev => ({ ...prev, step: 'creating', error: null }));
      
      const connector = await createConnector({
        type: state.provider,
        displayName: state.displayName || undefined,
        calendars: state.selectedCalendars,
      }, state.csrfToken);

      setState(prev => ({ 
        ...prev, 
        step: 'success', 
        createdConnectorId: connector.id 
      }));

      if (onConnectorCreated) {
        onConnectorCreated(connector.id);
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        step: 'error', 
        error: error instanceof Error ? error.message : 'Failed to create connector' 
      }));
    }
  };

  const handleBack = () => {
    if (state.step === 'calendar-selection') {
      setState(prev => ({ ...prev, step: 'provider-selection', provider: null }));
    }
  };

  const renderProviderSelection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Choose a Provider</h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          Select the calendar provider you want to connect to SynCal.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200 dark:hover:border-blue-800" 
          onClick={() => handleProviderSelect('google')}
        >
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center text-white text-xl font-bold mb-2">
              G
            </div>
            <CardTitle>Google Workspace</CardTitle>
            <CardDescription>Connect to Google Calendar</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>• Read and write calendar events</li>
              <li>• Access to all your Google calendars</li>
              <li>• Real-time synchronization</li>
            </ul>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200 dark:hover:border-blue-800" 
          onClick={() => handleProviderSelect('microsoft')}
        >
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xl font-bold mb-2">
              M
            </div>
            <CardTitle>Microsoft 365</CardTitle>
            <CardDescription>Connect to Outlook Calendar</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>• Read and write calendar events</li>
              <li>• Access to all your Outlook calendars</li>
              <li>• Real-time synchronization</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderOAuthPending = () => (
    <div className="text-center space-y-4">
      <div className="animate-spin mx-auto w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      <h2 className="text-xl font-semibold">Redirecting to {state.provider}...</h2>
      <p className="text-slate-600 dark:text-slate-300">
        You'll be redirected to authorize SynCal to access your {state.provider} calendars.
      </p>
      <p className="text-sm text-slate-500">
        If you're not redirected automatically, please check if pop-ups are blocked.
      </p>
    </div>
  );

  const renderCalendarSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">Select Calendars</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm">
            Choose which calendars to sync with SynCal.
          </p>
        </div>
        <button
          onClick={handleBack}
          className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 text-sm"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Display Name (optional)
          </label>
          <input
            type="text"
            placeholder={`${state.provider?.charAt(0).toUpperCase()}${state.provider?.slice(1)} Connector`}
            value={state.displayName}
            onChange={(e) => setState(prev => ({ ...prev, displayName: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Available Calendars ({state.calendars.length})
          </label>
          <div className="border border-slate-300 dark:border-slate-600 rounded-md max-h-64 overflow-y-auto">
            {state.calendars.map((calendar) => (
              <label
                key={calendar.id}
                className="flex items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-700 last:border-b-0 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={state.selectedCalendars.includes(calendar.id)}
                  onChange={() => handleCalendarToggle(calendar.id)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-sm">{calendar.summary}</span>
                    {calendar.primary && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
                        Primary
                      </span>
                    )}
                  </div>
                  {calendar.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {calendar.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {state.selectedCalendars.length === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Please select at least one calendar to continue.
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        >
          Cancel
        </button>
        <button
          onClick={handleCreateConnector}
          disabled={state.selectedCalendars.length === 0}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md font-medium disabled:cursor-not-allowed"
        >
          Create Connector
        </button>
      </div>
    </div>
  );

  const renderCreating = () => (
    <div className="text-center space-y-4">
      <div className="animate-spin mx-auto w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      <h2 className="text-xl font-semibold">Creating Connector...</h2>
      <p className="text-slate-600 dark:text-slate-300">
        Setting up your {state.provider} connector and validating access.
      </p>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">Connector Created Successfully!</h2>
      <p className="text-slate-600 dark:text-slate-300">
        Your {state.provider} connector is now set up and will begin syncing shortly.
      </p>
      <button
        onClick={onCancel}
        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium"
      >
        Done
      </button>
    </div>
  );

  const renderError = () => (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">Setup Failed</h2>
      <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto">
        {state.error}
      </p>
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setState(prev => ({ ...prev, step: 'provider-selection', error: null }))}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium"
        >
          Try Again
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        {state.step === 'provider-selection' && renderProviderSelection()}
        {state.step === 'oauth-pending' && renderOAuthPending()}
        {state.step === 'calendar-selection' && renderCalendarSelection()}
        {state.step === 'creating' && renderCreating()}
        {state.step === 'success' && renderSuccess()}
        {state.step === 'error' && renderError()}
      </CardContent>
    </Card>
  );
}