import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from './hooks/useAuth';

// Eagerly load auth pages and core components (needed immediately)
import Login from './pages/Login';
import Register from './pages/Register';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';

// Eagerly load all pages to avoid Cloudflare Access blocking dynamic imports
// Note: Code splitting with lazyWithRetry doesn't work through Cloudflare Access
// because dynamic import() requests don't include auth cookies properly
import Dashboard from './pages/Dashboard';
import ScriptManagement from './pages/ScriptManagement';
import ScriptDetail from './pages/ScriptDetail';
import ScriptEditor from './pages/ScriptEditor';
import ScriptAnalysis from './pages/ScriptAnalysis';
import SimpleChatWithAI from './pages/SimpleChatWithAI';
import Documentation from './pages/Documentation';
import NotFound from './pages/NotFound';
import ChatHistory from './pages/ChatHistory';
import DocumentationCrawl from './pages/DocumentationCrawl';
import CrawledData from './pages/CrawledData';
import ScriptUpload from './pages/ScriptUpload';
import AgenticAIPage from './pages/AgenticAIPage';
import AgentOrchestrationPage from './pages/AgentOrchestrationPage';
import UIComponentsDemo from './pages/UIComponentsDemo';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

// Eagerly load settings pages
import ProfileSettings from './pages/Settings/ProfileSettings';
import AppearanceSettings from './pages/Settings/AppearanceSettings';
import SecuritySettings from './pages/Settings/SecuritySettings';
import NotificationSettings from './pages/Settings/NotificationSettings';
import ApiSettings from './pages/Settings/ApiSettings';
import UserManagement from './pages/Settings/UserManagement';
import CategoriesSettings from './pages/Settings/CategoriesSettings';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Home route that shows Login for unauthenticated users, Dashboard for authenticated
const Home: React.FC = () => {
  const { user, isLoading } = useAuth();
  const disableAuth = import.meta.env.MODE !== 'test' && import.meta.env.VITE_DISABLE_AUTH === 'true';

  // When auth is disabled in local dev, avoid a "bounce" to /login (and confusing demo-login UX).
  if (disableAuth) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return user ? <Dashboard /> : <Navigate to="/login" replace />;
};

// Layout wrapper that conditionally shows navigation
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const isImmersiveRoute = location.pathname === '/chat' || location.pathname === '/ai/assistant';

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

  // Don't show sidebar/navbar on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage) {
    return <>{children}</>;
  }

  const reducedMotionInitial = prefersReducedMotion ? false : 'initial';

  return (
    <div className="flex h-screen app-shell bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            initial={reducedMotionInitial}
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
            className={`relative flex-1 ${
              isImmersiveRoute ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-6'
            }`}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastContainer position="top-right" theme="colored" />
        <AppLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />

            {/* Script Management */}
            <Route path="/scripts" element={<ProtectedRoute><ScriptManagement /></ProtectedRoute>} />
            <Route path="/scripts/upload" element={<ProtectedRoute><ScriptUpload /></ProtectedRoute>} />
            <Route path="/scripts/:id" element={<ScriptDetail />} />
            <Route path="/scripts/:id/edit" element={<ProtectedRoute><ScriptEditor /></ProtectedRoute>} />
            <Route path="/scripts/:id/analysis" element={<ScriptAnalysis />} />

            {/* AI Features */}
            <Route path="/chat" element={<SimpleChatWithAI />} />
            <Route path="/chat/history" element={<ProtectedRoute><ChatHistory /></ProtectedRoute>} />
            <Route path="/ai/assistant" element={<AgenticAIPage />} />
            <Route path="/ai/agents" element={<ProtectedRoute><AgentOrchestrationPage /></ProtectedRoute>} />

            {/* Documentation */}
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/documentation/crawl" element={<ProtectedRoute><DocumentationCrawl /></ProtectedRoute>} />
            <Route path="/documentation/data" element={<CrawledData />} />
            <Route path="/ui-components" element={<UIComponentsDemo />} />

            {/* Settings */}
            {/* Redirect legacy /settings landing to the unified SettingsLayout pages */}
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/advanced" element={<Navigate to="/settings/security" replace />} />
            <Route path="/settings/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
            <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
            <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
              <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
              <Route path="/settings/api" element={<ProtectedRoute><ApiSettings /></ProtectedRoute>} />
              <Route path="/settings/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/settings/categories" element={<ProtectedRoute><CategoriesSettings /></ProtectedRoute>} />

            {/* Fallbacks */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </AppLayout>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
