import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

// Define submenu item interface
interface SubmenuItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

// Define navigation item interface with optional submenu
interface NavItem {
  name: string;
  path?: string;
  icon: React.ReactNode;
  hasSubmenu?: boolean;
  submenuItems?: SubmenuItem[];
}

// Define props for Sidebar
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isAuthenticated } = useAuth();
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const hoverMotion = reducedMotion
    ? {}
    : ({
      whileHover: { x: 2 },
      transition: { type: 'spring', stiffness: 340, damping: 26 },
    } as const);

  // Define navigation items
  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: '/',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Script Management',
      path: '/scripts',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: 'AI Assistant',
      hasSubmenu: true,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      submenuItems: [
        {
          name: 'Chat Assistant',
          path: '/chat',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          ),
        },
        {
          name: 'Agentic Assistant',
          path: '/ai/assistant',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          ),
        }
      ]
    },
    {
      name: 'Documentation',
      path: '/documentation',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      name: 'UI Components',
      path: '/ui-components',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
  ];

  // Define authenticated-only items
  const authItems: NavItem[] = [
    {
      name: 'Settings',
      // Land users on the unified SettingsLayout pages (which include Script Categories).
      // Keeping /settings as a redirect avoids confusion with the legacy Settings page.
      path: '/settings/profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  // Define auth-related items
  const authActionItems: NavItem[] = isAuthenticated
    ? []
    : [
      {
        name: 'Login',
        path: '/login',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        ),
      },
      {
        name: 'Register',
        path: '/register',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ),
      },
    ];

  // Combine all items
  const allItems: NavItem[] = [...navItems, ...(isAuthenticated ? authItems : []), ...authActionItems];

  // Toggle AI submenu
  const toggleAiMenu = () => {
    setAiMenuOpen(!aiMenuOpen);
  };

  // Nav link base styles
  const navLinkBase = `
    flex items-center px-4 py-2.5 text-sm font-medium rounded-lg
    transition-all duration-200
  `;

  // Active nav link styles
  const navLinkActive = `
    bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/10
    text-[var(--color-primary)]
    border-l-3 border-[var(--color-primary)]
  `;

  // Inactive nav link styles
  const navLinkInactive = `
    text-[var(--color-text-secondary)]
    hover:text-[var(--color-text-primary)]
    hover:bg-[var(--color-bg-tertiary)]
  `;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } transition-transform duration-300 ease-in-out
          bg-[var(--color-bg-primary)]
          border-r border-[var(--color-border-default)]
          lg:translate-x-0 lg:static lg:w-auto`}
      >
        {/* Logo and close button */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-3">
            {/* Logo icon */}
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center shadow-lg animate-float"
              {...(reducedMotion ? {} : { whileHover: { rotate: 8, scale: 1.02 } })}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </motion.div>
            <div>
              <div className="text-lg font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">
                PSScript
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)]">
                AI-Powered
              </div>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="p-2 rounded-lg lg:hidden text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Close menu"
            {...hoverMotion}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3 flex-1">
          <div className="space-y-1">
            {allItems.map((item, index) => (
              item.hasSubmenu ? (
                <div key={`submenu-${index}`}>
                  {/* Parent menu item with submenu */}
                  <motion.button
                    onClick={toggleAiMenu}
                    className={`w-full ${navLinkBase} ${navLinkInactive} justify-between`}
                    {...hoverMotion}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--color-text-tertiary)]">{item.icon}</span>
                      {item.name}
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 transition-transform duration-200 ${aiMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.button>

                  {/* Submenu items with animation */}
                  <div className={`overflow-hidden transition-all duration-200 ${aiMenuOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-6 mt-1 space-y-1 border-l-2 border-[var(--color-border-default)] ml-6">
                      {item.submenuItems?.map((subItem, subIndex) => (
                    <motion.div
                          key={`subitem-${subIndex}`}
                          initial={reducedMotion ? undefined : { opacity: 0, x: -4 }}
                          animate={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                          transition={reducedMotion ? undefined : { duration: 0.2, delay: subIndex * 0.03 }}
                        >
                          <NavLink
                            key={`subitem-${subIndex}`}
                            to={subItem.path}
                            className={({ isActive }) =>
                              `${navLinkBase} ${isActive ? navLinkActive : navLinkInactive} gap-3`
                            }
                            onClick={onClose}
                          >
                            <span className="text-[var(--color-text-tertiary)]">{subItem.icon}</span>
                            {subItem.name}
                          </NavLink>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  key={item.path}
                  initial={reducedMotion ? undefined : { opacity: 0, x: -4 }}
                  animate={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                  transition={reducedMotion ? undefined : { duration: 0.2, delay: index * 0.03 }}
                >
                <NavLink
                  key={item.path}
                  to={item.path!}
                  className={({ isActive }) =>
                    `${navLinkBase} ${isActive ? navLinkActive : navLinkInactive} gap-3`
                  }
                  onClick={onClose}
                >
                  <span className="text-[var(--color-text-tertiary)]">{item.icon}</span>
                  {item.name}
                </NavLink>
                </motion.div>
              )
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 w-full p-4 border-t border-[var(--color-border-default)]">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--color-text-tertiary)]">
              <p className="font-medium">&copy; 2025 PSScript</p>
              <p className="mt-0.5 opacity-75">AI-Powered Management</p>
            </div>
            {/* Version badge */}
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
              v1.0
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
