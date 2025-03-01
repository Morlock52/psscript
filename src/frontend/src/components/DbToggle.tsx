import React, { useState, useEffect } from 'react';
import { loadSettings, toggleDatabaseMode } from '../services/settings';

const DbToggle: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings());
  const [isVisible, setIsVisible] = useState(false);

  // Check if the toggle should be visible
  useEffect(() => {
    setIsVisible(settings.showDbToggle);
    
    // Set up a listener for settings changes
    const checkSettings = () => {
      const newSettings = loadSettings();
      setSettings(newSettings);
      setIsVisible(newSettings.showDbToggle);
    };
    
    // Check settings every second
    const interval = setInterval(checkSettings, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Handle toggle click with improved state synchronization
  const handleToggle = () => {
    const newSettings = toggleDatabaseMode();
    setSettings(newSettings);
    
    // Make sure the localStorage value is set immediately
    localStorage.setItem('use_mock_data', newSettings.useMockData.toString());
    
    // Log status for debugging
    console.log(`Database mode changed to: ${newSettings.useMockData ? 'Mock' : 'Production'}`);
    
    // Dispatch event to notify all tabs/windows
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'use_mock_data',
      newValue: newSettings.useMockData.toString(),
      storageArea: localStorage
    }));
    
    // Reload the page to apply the changes
    window.location.reload();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={handleToggle}
        className={`px-4 py-2 rounded-lg font-medium shadow-lg transition-colors ${
          settings.useMockData
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
        title={settings.useMockData ? 'Using Mock Database' : 'Using Production Database'}
      >
        <div className="flex items-center space-x-2">
          <span className={`inline-block w-3 h-3 rounded-full ${settings.useMockData ? 'bg-yellow-300' : 'bg-green-300'}`}></span>
          <span>{settings.useMockData ? 'Mock DB' : 'Prod DB'}</span>
        </div>
      </button>
    </div>
  );
};

export default DbToggle;