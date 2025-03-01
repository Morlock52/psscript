import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface NavbarProps {
  onToggleSidebar: () => void;
  onToggleTheme?: () => void;
  theme?: 'dark' | 'light';
  sidebarOpen?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ 
  onToggleSidebar, 
  onToggleTheme, 
  theme = 'dark',
  sidebarOpen = true
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<{id: number, message: string, read: boolean}[]>([
    { id: 1, message: 'New script version uploaded', read: false },
    { id: 2, message: 'Security analysis complete', read: false }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/scripts') return 'Scripts';
    if (path === '/scripts/upload') return 'Upload Script';
    if (path === '/scripts/manage') return 'Manage Scripts';
    if (path.startsWith('/scripts/') && path !== '/scripts/upload' && path !== '/scripts/manage') return 'Script Details';
    if (path === '/analytics') return 'Analytics';
    if (path === '/settings') return 'Settings';
    if (path === '/settings/profile') return 'Profile Settings';
    if (path === '/settings/appearance') return 'Appearance Settings';
    if (path === '/settings/security') return 'Security Settings';
    if (path === '/settings/notifications') return 'Notification Settings';
    if (path === '/settings/api') return 'API Settings';
    return 'PowerShell Script Manager';
  };
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/scripts?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };
  
  return (
    <nav className={`border-b px-4 py-2.5 transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gray-800 border-gray-700 text-white' 
        : 'bg-white border-gray-200 text-gray-800'
    }`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            className={`hover:bg-opacity-20 rounded p-1 focus:outline-none ${
              theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-800'
            }`}
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Page title - shows current location */}
          <h1 className="text-lg font-medium hidden md:block">{getPageTitle()}</h1>
          
          {/* Search form */}
          <form onSubmit={handleSearch} className="relative w-64 ml-4">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
              </svg>
            </div>
            <input
              type="text"
              className={`border text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2 ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Search scripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Theme toggle button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-lg hover:bg-opacity-20 ${
                theme === 'dark' 
                  ? 'text-gray-300 hover:text-white hover:bg-white' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-800'
              }`}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          )}
          
          {/* Notification button */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              className={`relative p-2 rounded-lg hover:bg-opacity-20 ${
                theme === 'dark' 
                  ? 'text-gray-300 hover:text-white hover:bg-white' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-800'
              }`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className={`absolute right-0 mt-2 w-72 rounded-lg divide-y shadow-lg z-10 ${
                theme === 'dark' 
                  ? 'bg-gray-700 divide-gray-600 text-white' 
                  : 'bg-white divide-gray-200 text-gray-900'
              }`}>
                <div className="py-2 px-4 font-medium">
                  Notifications
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-600">
                  {notifications.length > 0 ? (
                    notifications.map(notification => (
                      <div 
                        key={notification.id} 
                        className={`py-3 px-4 hover:bg-opacity-10 ${
                          theme === 'dark' 
                            ? 'hover:bg-white' 
                            : 'hover:bg-gray-800'
                        } ${!notification.read ? 'font-semibold' : ''}`}
                      >
                        <div className="flex justify-between">
                          <span>{notification.message}</span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 px-4 text-center text-gray-500">
                      No new notifications
                    </div>
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="py-2 px-4 text-center text-sm">
                    <button 
                      className={`text-blue-500 hover:underline`}
                      onClick={() => {
                        setNotifications(notifications.map(n => ({...n, read: true})));
                        setShowNotifications(false);
                      }}
                    >
                      Mark all as read
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* User profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              className={`flex items-center space-x-2 rounded-lg p-1 ${
                theme === 'dark' 
                  ? 'hover:bg-white' 
                  : 'hover:bg-gray-800'
              } hover:bg-opacity-10`}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <span className="sr-only">Open user menu</span>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden md:block">{user?.username || 'User'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isProfileOpen && (
              <div className={`absolute right-0 mt-2 w-48 rounded-lg divide-y shadow-lg z-10 ${
                theme === 'dark' 
                  ? 'bg-gray-700 divide-gray-600' 
                  : 'bg-white divide-gray-200'
              }`}>
                <div className="py-3 px-4 text-sm">
                  <div className="font-medium truncate">{user?.username || 'User'}</div>
                  <div className={`truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {user?.email || 'user@example.com'}
                  </div>
                </div>
                <ul className="py-1 text-sm">
                  <li>
                    <Link
                      to="/settings/profile"
                      className={`block py-2 px-4 ${
                        theme === 'dark' 
                          ? 'hover:bg-gray-600' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Profile Settings
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/"
                      className={`block py-2 px-4 ${
                        theme === 'dark' 
                          ? 'hover:bg-gray-600' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/scripts/upload"
                      className={`block py-2 px-4 ${
                        theme === 'dark' 
                          ? 'hover:bg-gray-600' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Upload Script
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/manage-files"
                      className={`block py-2 px-4 ${
                        theme === 'dark' 
                          ? 'hover:bg-gray-600' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Manage Scripts
                    </Link>
                  </li>
                </ul>
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className={`block w-full text-left py-2 px-4 text-sm ${
                      theme === 'dark' 
                        ? 'hover:bg-gray-600' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;