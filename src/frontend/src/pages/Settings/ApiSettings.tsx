import React, { useState } from 'react';
import SettingsLayout from './SettingsLayout';

const ApiSettings: React.FC = () => {
  // API key state
  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: 'Development', key: 'ps_api_dev_123456789abcdef', created: '2024-02-15', lastUsed: '2024-02-25', status: 'active' },
    { id: '2', name: 'CI Pipeline', key: 'ps_api_ci_987654321fedcba', created: '2024-01-10', lastUsed: '2024-02-28', status: 'active' }
  ]);
  
  const [newKeyName, setNewKeyName] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  
  // Webhooks state
  const [webhooks, setWebhooks] = useState([
    { id: '1', url: 'https://example.com/webhook1', events: ['script.created', 'script.executed'], status: 'active' },
    { id: '2', url: 'https://ci.company.com/psscript-hook', events: ['script.executed'], status: 'inactive' }
  ]);
  
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isAddingWebhook, setIsAddingWebhook] = useState(false);
  
  // Available webhook events
  const availableEvents = [
    { id: 'script.created', name: 'Script Created' },
    { id: 'script.updated', name: 'Script Updated' },
    { id: 'script.deleted', name: 'Script Deleted' },
    { id: 'script.executed', name: 'Script Executed' },
    { id: 'user.login', name: 'User Login' }
  ];
  
  // Generate a new API key
  const handleGenerateKey = () => {
    if (!newKeyName.trim()) {
      setErrorMessage('Please enter a name for the API key');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    setIsGeneratingKey(true);
    setErrorMessage('');
    
    // Simulate API key generation
    setTimeout(() => {
      const newKey = `ps_api_${Math.random().toString(36).substring(2, 8)}_${Math.random().toString(36).substring(2, 15)}`;
      const keyObj = {
        id: Date.now().toString(),
        name: newKeyName,
        key: newKey,
        created: new Date().toISOString().split('T')[0],
        lastUsed: '-',
        status: 'active'
      };
      
      setApiKeys([...apiKeys, keyObj]);
      setNewKeyName('');
      setShowNewKey(newKey);
      setIsGeneratingKey(false);
      setSuccessMessage('API key generated successfully');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    }, 1000);
  };
  
  // Revoke an API key
  const handleRevokeKey = (id: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      setApiKeys(apiKeys.map(key => 
        key.id === id ? { ...key, status: 'revoked' } : key
      ));
      
      setSuccessMessage('API key revoked successfully');
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }
  };
  
  // Add a new webhook
  const handleAddWebhook = () => {
    if (!newWebhookUrl.trim()) {
      setErrorMessage('Please enter a webhook URL');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    if (selectedEvents.length === 0) {
      setErrorMessage('Please select at least one event');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    setIsAddingWebhook(true);
    
    // Simulate adding webhook
    setTimeout(() => {
      const newWebhook = {
        id: Date.now().toString(),
        url: newWebhookUrl,
        events: selectedEvents,
        status: 'active'
      };
      
      setWebhooks([...webhooks, newWebhook]);
      setNewWebhookUrl('');
      setSelectedEvents([]);
      setIsAddingWebhook(false);
      setSuccessMessage('Webhook added successfully');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }, 800);
  };
  
  // Toggle webhook status
  const toggleWebhookStatus = (id: string) => {
    setWebhooks(webhooks.map(webhook => 
      webhook.id === id 
        ? { ...webhook, status: webhook.status === 'active' ? 'inactive' : 'active' } 
        : webhook
    ));
  };
  
  // Delete webhook
  const handleDeleteWebhook = (id: string) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      setWebhooks(webhooks.filter(webhook => webhook.id !== id));
      
      setSuccessMessage('Webhook deleted successfully');
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }
  };
  
  // Toggle event selection
  const toggleEvent = (eventId: string) => {
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter(id => id !== eventId));
    } else {
      setSelectedEvents([...selectedEvents, eventId]);
    }
  };

  return (
    <SettingsLayout 
      title="API Settings" 
      description="Manage API keys and webhooks for integrating with external services"
    >
      {/* Success message */}
      {successMessage && (
        <div className="mb-6 p-3 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-md">
          {successMessage}
        </div>
      )}
      
      {/* Error message */}
      {errorMessage && (
        <div className="mb-6 p-3 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded-md">
          {errorMessage}
        </div>
      )}
      
      {/* New key display */}
      {showNewKey && (
        <div className="mb-6 p-4 border border-yellow-400 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">Your New API Key</h3>
            <button 
              onClick={() => setShowNewKey(null)}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
            Please copy your API key now. For security reasons, it won't be displayed again.
          </p>
          <div className="flex">
            <code className="flex-1 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-l-md font-mono text-sm">
              {showNewKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(showNewKey);
                setSuccessMessage('API key copied to clipboard');
                setTimeout(() => setSuccessMessage(''), 3000);
              }}
              className="px-3 bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-700 rounded-r-md hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Copy to clipboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* API Keys Section */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4">API Keys</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          API keys allow you to authenticate requests to the PSScript API for integration with external systems.
        </p>
        
        {/* API Keys Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {apiKeys.map(key => (
                <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {key.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {key.created}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {key.lastUsed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      key.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {key.status === 'active' ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {key.status === 'active' && (
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Generate API Key Form */}
        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <h3 className="font-medium mb-4">Generate New API Key</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="API Key Name (e.g. Development, Production)"
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={handleGenerateKey}
              disabled={isGeneratingKey}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center justify-center whitespace-nowrap"
            >
              {isGeneratingKey ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate API Key'
              )}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            API keys provide full access to your account. Keep them secure and never share them in public repositories.
          </p>
        </div>
      </div>
      
      {/* Webhooks Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Webhooks</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Webhooks allow external services to receive notifications when specific events occur in your PSScript account.
        </p>
        
        {/* Webhooks Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Endpoint URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Events</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {webhooks.map(webhook => (
                <tr key={webhook.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm font-medium truncate max-w-xs">
                    {webhook.url}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map(event => (
                        <span 
                          key={event} 
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full"
                        >
                          {availableEvents.find(e => e.id === event)?.name || event}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleWebhookStatus(webhook.id)}
                      className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${
                        webhook.status === 'active' 
                          ? 'bg-green-500' 
                          : 'bg-gray-400 dark:bg-gray-600'
                      }`}
                    >
                      <span className="sr-only">
                        {webhook.status === 'active' ? 'Deactivate' : 'Activate'}
                      </span>
                      <span 
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                          webhook.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Add Webhook Form */}
        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <h3 className="font-medium mb-4">Add New Webhook</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Events to Subscribe
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {availableEvents.map(event => (
                <div key={event.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`event-${event.id}`}
                    checked={selectedEvents.includes(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`event-${event.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    {event.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleAddWebhook}
              disabled={isAddingWebhook}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center"
            >
              {isAddingWebhook ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                'Add Webhook'
              )}
            </button>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

export default ApiSettings;