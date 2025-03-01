import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import DbToggle from './DbToggle';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(
    localStorage.getItem('sidebar-open') === 'false' ? false : true
  );
  
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('color-theme') as 'dark' | 'light') || 'dark'
  );

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-open', String(sidebarOpen));
  }, [sidebarOpen]);
  
  // Initialize theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('color-theme', newTheme);
  };
  
  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300
      ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Sidebar with animation */}
      <div 
        className={`transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-0 md:w-16'} 
          ${sidebarOpen ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}
      >
        <Sidebar collapsed={!sidebarOpen} theme={theme} />
      </div>
      
      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar 
          onToggleSidebar={toggleSidebar} 
          onToggleTheme={toggleTheme}
          theme={theme}
          sidebarOpen={sidebarOpen}
        />
        
        <main className={`flex-1 overflow-y-auto p-4 transition-colors duration-300
          ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <Outlet />
        </main>
        
        {/* DB Toggle Button */}
        <DbToggle />
      </div>
    </div>
  );
};

export default Layout;