import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { categoryService } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// Category type definition
interface Category {
  id: number;
  name: string;
  description?: string;
}

interface SidebarProps {
  collapsed?: boolean;
  theme?: 'dark' | 'light';
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed = false,
  theme = 'dark' 
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    categories: true,
    favorites: false
  });
  
  // Fetch categories with react-query
  const { 
    data: categoriesData,
    isLoading: isCategoriesLoading 
  } = useQuery(
    ['categories'], 
    () => categoryService.getCategories(),
    { 
      staleTime: 600000, // 10 minutes
      refetchOnWindowFocus: false
    }
  );
  
  // Extract categories from query result
  const categories: Category[] = categoriesData?.categories || [];
  
  // Recently viewed scripts from localStorage
  const [recentScripts, setRecentScripts] = useState<{id: string, title: string}[]>([]);

  // Load recent scripts from localStorage on mount
  useEffect(() => {
    try {
      const savedRecent = localStorage.getItem('recentScripts');
      if (savedRecent) {
        setRecentScripts(JSON.parse(savedRecent));
      }
    } catch (e) {
      console.error('Error loading recent scripts:', e);
    }
  }, []);
  
  // Update recent scripts when visiting script detail page
  useEffect(() => {
    const match = location.pathname.match(/\/scripts\/(\d+)/);
    if (match && match[1]) {
      // Extract script ID and title from URL or page data
      // For demo, we'll use a placeholder title
      const scriptId = match[1];
      const scriptTitle = document.title.replace(' | PSScript', '') || 'Script ' + scriptId;
      
      setRecentScripts(prev => {
        // Remove if exists already
        const filtered = prev.filter(s => s.id !== scriptId);
        // Add to beginning, limit to 5 items
        const updated = [{ id: scriptId, title: scriptTitle }, ...filtered].slice(0, 5);
        // Save to localStorage
        localStorage.setItem('recentScripts', JSON.stringify(updated));
        return updated;
      });
    }
  }, [location.pathname]);
  
  // Toggle expanded sections
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);
  
  // Navigation items
  const navItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
        </svg>
      ),
    },
    {
      name: 'Scripts',
      path: '/scripts',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
        </svg>
      ),
    },
    {
      name: 'Upload',
      path: '/scripts/upload',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
      ),
    },
    {
      name: 'Manage',
      path: '/scripts/manage',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
      ),
    },
    {
      name: 'Analytics',
      path: '/analytics',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
      ),
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      ),
    },
  ];

  return (
    <aside 
      className={`h-full flex flex-col overflow-hidden transition-all duration-300
        ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'} 
        ${theme === 'dark' ? 'border-r border-gray-700' : 'border-r border-gray-200'}`}
    >
      {/* Logo section */}
      <div className={`flex items-center justify-between h-16 px-4 
        ${theme === 'dark' ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-bold">
            PS
          </div>
          {!collapsed && <span className="text-lg font-semibold">PSScript</span>}
          {!collapsed && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white">BETA</span>}
        </div>
      </div>
      
      {/* Main navigation */}
      <nav className={`flex-shrink-0 p-2 ${collapsed ? 'mt-2' : 'mt-4'}`}>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center p-2 rounded-lg transition-colors duration-200
                  ${isActive 
                    ? theme === 'dark' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-100 text-blue-800'
                    : theme === 'dark'
                      ? 'text-gray-300 hover:bg-gray-800'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${!collapsed ? 'justify-start' : 'justify-center'}`
                }
                title={collapsed ? item.name : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="ml-3">{item.name}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Categories section */}
      {!collapsed && (
        <div className={`mt-2 px-3 overflow-hidden
          ${theme === 'dark' ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
          <div 
            className="flex items-center justify-between py-3 cursor-pointer"
            onClick={() => toggleSection('categories')}
          >
            <h3 className={`text-xs font-medium uppercase tracking-wider
              ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Categories
            </h3>
            <svg 
              className={`w-3 h-3 transform transition-transform
                ${expandedSections.categories ? 'rotate-0' : '-rotate-90'}
                ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {expandedSections.categories && (
            <div className="overflow-y-auto max-h-40 pb-2 transition-all duration-300">
              {isCategoriesLoading ? (
                <div className={`flex justify-center py-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading...</span>
                </div>
              ) : categories.length > 0 ? (
                <ul className="space-y-1">
                  {categories.map(category => (
                    <li key={category.id}>
                      <NavLink
                        to={`/scripts?category=${category.id}`}
                        className={({ isActive }) => `block px-3 py-2 text-sm rounded-md
                          ${isActive
                            ? theme === 'dark'
                              ? 'bg-gray-700 text-white'
                              : 'bg-gray-100 text-gray-900'
                            : theme === 'dark'
                              ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        title={category.description}
                      >
                        {category.name}
                      </NavLink>
                    </li>
                  ))}
                  <li>
                    <NavLink
                      to="/categories"
                      className={`block px-3 py-2 text-sm rounded-md
                        ${theme === 'dark'
                          ? 'text-blue-400 hover:bg-gray-800'
                          : 'text-blue-600 hover:bg-gray-50'
                        }`}
                    >
                      View all categories...
                    </NavLink>
                  </li>
                </ul>
              ) : (
                <div className={`text-center py-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  No categories found
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Recently viewed section */}
      {!collapsed && recentScripts.length > 0 && (
        <div className={`mt-2 px-3 overflow-hidden
          ${theme === 'dark' ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
          <div 
            className="flex items-center justify-between py-3 cursor-pointer"
            onClick={() => toggleSection('recent')}
          >
            <h3 className={`text-xs font-medium uppercase tracking-wider
              ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Recent
            </h3>
            <svg 
              className={`w-3 h-3 transform transition-transform
                ${expandedSections.recent ? 'rotate-0' : '-rotate-90'}
                ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {expandedSections.recent && (
            <div className="overflow-y-auto max-h-40 pb-2">
              <ul className="space-y-1">
                {recentScripts.map(script => (
                  <li key={script.id}>
                    <NavLink
                      to={`/scripts/${script.id}`}
                      className={({ isActive }) => `block px-3 py-2 text-sm rounded-md truncate
                        ${isActive
                          ? theme === 'dark'
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-100 text-gray-900'
                          : theme === 'dark'
                            ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      {script.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Favorites section */}
      {!collapsed && (
        <div className={`mt-2 px-3 overflow-hidden
          ${theme === 'dark' ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
          <div 
            className="flex items-center justify-between py-3 cursor-pointer"
            onClick={() => toggleSection('favorites')}
          >
            <h3 className={`text-xs font-medium uppercase tracking-wider
              ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Favorites
            </h3>
            <svg 
              className={`w-3 h-3 transform transition-transform
                ${expandedSections.favorites ? 'rotate-0' : '-rotate-90'}
                ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {expandedSections.favorites && (
            <div className="flex flex-col items-center justify-center py-4 px-3">
              <svg
                className={`w-6 h-6 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Star scripts to add them here
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Spacer to push user section to bottom */}
      <div className="flex-grow"></div>
      
      {/* User section at bottom */}
      {!collapsed && (
        <div className={`p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} border-t
          ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.username || 'User'}
              </p>
              <p className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;