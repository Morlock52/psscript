import React, { useState, useEffect, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
interface LayoutProps {
  children?: ReactNode;
  hideSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hideSidebar = false }) => {
  // Sidebar state with localStorage persistence
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-open');
    return saved === 'false' ? false : true;
  });
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const pageVariants = {
    initial: {
      opacity: 0,
      y: 10,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: -8,
    },
  };

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-open', String(sidebarOpen));
  }, [sidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden app-shell bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      {/* Sidebar with animation */}
      {!hideSidebar && (
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar onMenuClick={toggleSidebar} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            initial={prefersReducedMotion ? false : 'initial'}
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
            className="relative flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--color-bg-secondary)] transition-colors duration-300"
          >
            {children || <Outlet />}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Layout;
