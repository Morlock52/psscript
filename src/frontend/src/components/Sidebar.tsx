import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-700 overflow-y-auto">
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
        <div className="flex items-center">
          <span className="text-xl font-semibold text-white">PSScript</span>
          <span className="ml-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">BETA</span>
        </div>
      </div>
      
      <div className="py-4 px-4">
        <ul className="space-y-2">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center p-2 text-base font-medium rounded-lg ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                ></path>
              </svg>
              <span className="ml-3">Dashboard</span>
            </NavLink>
          </li>
          
          <li>
            <NavLink
              to="/scripts"
              className={({ isActive }) =>
                `flex items-center p-2 text-base font-medium rounded-lg ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                ></path>
              </svg>
              <span className="ml-3">Scripts</span>
            </NavLink>
          </li>
          
          <li>
            <NavLink
              to="/scripts/upload"
              className={({ isActive }) =>
                `flex items-center p-2 text-base font-medium rounded-lg ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <span className="ml-3">Upload</span>
            </NavLink>
          </li>
          
          <li>
            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                `flex items-center p-2 text-base font-medium rounded-lg ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                ></path>
              </svg>
              <span className="ml-3">Analytics</span>
            </NavLink>
          </li>
        </ul>
      </div>
      
      <div className="pt-4 mt-4 border-t border-gray-700">
        <div className="px-4">
          <h6 className="text-gray-400 text-xs font-medium uppercase tracking-wider">
            Categories
          </h6>
          <ul className="mt-3 space-y-2">
            <li>
              <a
                href="#"
                className="flex items-center p-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white"
              >
                System Administration
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center p-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white"
              >
                Network Management
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center p-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white"
              >
                Active Directory
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center p-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white"
              >
                Security Tools
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center p-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white"
              >
                More Categories...
              </a>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;