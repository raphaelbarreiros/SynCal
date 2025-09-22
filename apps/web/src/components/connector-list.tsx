'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncal/ui';
import type { Connector } from '../../lib/api-client';
import { listConnectors } from '../../lib/api-client';

interface ConnectorListProps {
  onAddConnector?: () => void;
  refresh?: number; // Used to trigger refresh from parent
}

export default function ConnectorList({ onAddConnector, refresh }: ConnectorListProps) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listConnectors();
      setConnectors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConnectors();
  }, [refresh]);

  const getStatusBadgeClass = (status: Connector['status']) => {
    switch (status) {
      case 'validated':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending_validation':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'disabled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getProviderIcon = (type: Connector['type']) => {
    switch (type) {
      case 'google':
        return (
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            G
          </div>
        );
      case 'microsoft':
        return (
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            M
          </div>
        );
      case 'html_ics':
        return (
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            H
          </div>
        );
      case 'imap':
        return (
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            @
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            ?
          </div>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin mx-auto w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Loading connectors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="text-center py-8">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => void loadConnectors()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
          >
            Try Again
          </button>
        </CardContent>
      </Card>
    );
  }

  if (connectors.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Connectors Yet</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Get started by connecting your first calendar provider.
          </p>
          {onAddConnector && (
            <button
              onClick={onAddConnector}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium"
            >
              Add Your First Connector
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Connectors ({connectors.length})</h2>
        {onAddConnector && (
          <button
            onClick={onAddConnector}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
          >
            Add Connector
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {connectors.map((connector) => (
          <Card key={connector.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  {getProviderIcon(connector.type)}
                  <div>
                    <CardTitle className="text-base">
                      {connector.displayName || `${connector.type.charAt(0).toUpperCase()}${connector.type.slice(1)} Connector`}
                    </CardTitle>
                    <CardDescription>
                      {connector.calendars ? `${connector.calendars.length} calendars` : 'No calendars'}
                      {' • '}
                      Created {formatDate(connector.createdAt)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusBadgeClass(connector.status)}`}>
                    {connector.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </CardHeader>

            {connector.calendars && connector.calendars.length > 0 && (
              <CardContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Connected Calendars:</h4>
                  <div className="grid gap-2">
                    {connector.calendars.slice(0, 3).map((calendar) => (
                      <div key={calendar.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                          {calendar.displayName || calendar.providerCalendarId}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          calendar.privacyMode === 'original_title' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                        }`}>
                          {calendar.privacyMode.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                    {connector.calendars.length > 3 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        +{connector.calendars.length - 3} more calendars
                      </p>
                    )}
                  </div>
                </div>

                {connector.lastValidatedAt && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Last validated: {formatDate(connector.lastValidatedAt)}
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}