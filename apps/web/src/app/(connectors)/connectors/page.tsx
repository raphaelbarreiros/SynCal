'use client';

import { useState } from 'react';
import ConnectorWizard from '../../../components/connector-wizard';
import ConnectorList from '../../../components/connector-list';

export default function ConnectorsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [refreshConnectors, setRefreshConnectors] = useState(0);

  const handleAddConnector = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = (connectorId: string) => {
    setShowWizard(false);
    setRefreshConnectors(prev => prev + 1); // Trigger refresh of connector list
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Connectors</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manage your calendar connections. Connect Google Workspace, Microsoft 365, and other providers to sync events with SynCal.
        </p>
      </header>

      {showWizard ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Add New Connector</h2>
            <button
              onClick={handleWizardCancel}
              className="px-3 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 text-sm"
            >
              Cancel
            </button>
          </div>
          <ConnectorWizard 
            onConnectorCreated={handleWizardComplete}
            onCancel={handleWizardCancel}
          />
        </div>
      ) : (
        <ConnectorList 
          onAddConnector={handleAddConnector}
          refresh={refreshConnectors}
        />
      )}
    </div>
  );
}
