import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

const Settings: React.FC = () => {
  // Theme settings
  const { theme, setTheme } = useTheme();
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    scriptExecutionAlerts: true,
    securityAlerts: true,
    weeklyDigest: false
  });
  
  // API settings
  const [apiSettings, setApiSettings] = useState({
    apiKey: 'sk-••••••••••••••••••••••••',
    showApiKey: false
  });
  
  // Display settings
  const [displaySettings, setDisplaySettings] = useState({
    itemsPerPage: '10',
    defaultSort: 'updated',
    codeEditorTheme: 'vs-dark'
  });
  
  // Handle notification toggle
  const handleNotificationToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNotifications(prev => ({ ...prev, [name]: checked }));
  };
  
  // Handle display settings change
  const handleDisplayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDisplaySettings(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle API key toggle
  const toggleApiKeyVisibility = () => {
    setApiSettings(prev => ({ ...prev, showApiKey: !prev.showApiKey }));
  };
  
  // Regenerate API key
  const regenerateApiKey = () => {
    // This would call an API to regenerate the key
    const mockNewKey = 'sk-' + Math.random().toString(36).substring(2, 15);
    setApiSettings(prev => ({ ...prev, apiKey: mockNewKey }));
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Appearance */}
        <div className="bg-gray-700 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Appearance</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Theme</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-4 py-2 rounded-md transition ${
                    theme === 'light'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-4 py-2 rounded-md transition ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
            
            <div>
              <label htmlFor="itemsPerPage" className="block text-sm text-gray-400 mb-2">
                Items Per Page
              </label>
              <select
                id="itemsPerPage"
                name="itemsPerPage"
                value={displaySettings.itemsPerPage}
                onChange={handleDisplayChange}
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-full"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="defaultSort" className="block text-sm text-gray-400 mb-2">
                Default Sort
              </label>
              <select
                id="defaultSort"
                name="defaultSort"
                value={displaySettings.defaultSort}
                onChange={handleDisplayChange}
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-full"
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="name">Name</option>
                <option value="quality">Quality Score</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="codeEditorTheme" className="block text-sm text-gray-400 mb-2">
                Code Editor Theme
              </label>
              <select
                id="codeEditorTheme"
                name="codeEditorTheme"
                value={displaySettings.codeEditorTheme}
                onChange={handleDisplayChange}
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 w-full"
              >
                <option value="vs-dark">Dark (VS Code)</option>
                <option value="vs-light">Light (VS Code)</option>
                <option value="hc-black">High Contrast</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Notifications */}
        <div className="bg-gray-700 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="emailNotifications" className="text-gray-300">
                Email Notifications
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  name="emailNotifications"
                  className="sr-only peer"
                  checked={notifications.emailNotifications}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <label htmlFor="scriptExecutionAlerts" className="text-gray-300">
                Script Execution Alerts
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="scriptExecutionAlerts"
                  name="scriptExecutionAlerts"
                  className="sr-only peer"
                  checked={notifications.scriptExecutionAlerts}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <label htmlFor="securityAlerts" className="text-gray-300">
                Security Alerts
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="securityAlerts"
                  name="securityAlerts"
                  className="sr-only peer"
                  checked={notifications.securityAlerts}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <label htmlFor="weeklyDigest" className="text-gray-300">
                Weekly Digest
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="weeklyDigest"
                  name="weeklyDigest"
                  className="sr-only peer"
                  checked={notifications.weeklyDigest}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
        
        {/* API Settings */}
        <div className="bg-gray-700 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">API Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">API Key</label>
              <div className="flex">
                <input
                  type={apiSettings.showApiKey ? "text" : "password"}
                  value={apiSettings.apiKey}
                  readOnly
                  className="bg-gray-800 border border-gray-600 rounded-l-md px-3 py-2 w-full"
                />
                <button
                  onClick={toggleApiKeyVisibility}
                  className="bg-gray-600 text-gray-300 px-3 py-2 rounded-r-md hover:bg-gray-500 transition"
                >
                  {apiSettings.showApiKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            
            <button
              onClick={regenerateApiKey}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition w-full"
            >
              Regenerate API Key
            </button>
            
            <div className="mt-4 p-4 bg-gray-800 rounded-md text-sm">
              <p className="text-gray-400 mb-2">API Usage This Month:</p>
              <div className="flex justify-between mb-1">
                <span className="text-gray-300">Script Analysis</span>
                <span className="text-gray-300">245 / 1000</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mb-4">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: '24.5%' }}
                ></div>
              </div>
              
              <div className="flex justify-between mb-1">
                <span className="text-gray-300">Script Executions</span>
                <span className="text-gray-300">87 / 500</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div
                  className="bg-green-500 h-2.5 rounded-full"
                  style={{ width: '17.4%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Account Security */}
      <div className="mt-6 bg-gray-700 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Account Security</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Change Password</h3>
            <form className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm text-gray-400 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label htmlFor="newPassword" className="block text-sm text-gray-400 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm text-gray-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2"
                />
              </div>
              
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              >
                Update Password
              </button>
            </form>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-3">Two-Factor Authentication</h3>
            <p className="text-gray-400 mb-4">
              Enhance your account security by enabling two-factor authentication.
            </p>
            
            <div className="p-4 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-md mb-4">
              <p className="text-yellow-500">
                Two-factor authentication is currently disabled.
              </p>
            </div>
            
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Enable 2FA
            </button>
          </div>
        </div>
      </div>
      
      {/* Save Settings Button */}
      <div className="mt-6 flex justify-end">
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
        >
          Save All Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;