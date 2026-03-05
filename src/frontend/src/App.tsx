import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from './hooks/useAuth';
import lazyWithRetry from './utils/lazyWithRetry';

// Eagerly load auth pages and core components (needed immediately)
import Login from './pages/Login';
import Register from './pages/Register';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';

// Heavy pages are lazily loaded to reduce initial JS bundle size.
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const ScriptManagement = lazyWithRetry(() => import('./pages/ScriptManagement'));
const ScriptUpload = lazyWithRetry(() => import('./pages/ScriptUpload'));
const ScriptDetail = lazyWithRetry(() => import('./pages/ScriptDetail'));
const ScriptEditor = lazyWithRetry(() => import('./pages/ScriptEditor'));
const ScriptAnalysis = lazyWithRetry(() => import('./pages/ScriptAnalysis'));
const SimpleChatWithAI = lazyWithRetry(() => import('./pages/SimpleChatWithAI'));
const ChatHistory = lazyWithRetry(() => import('./pages/ChatHistory'));
const AgenticAIPage = lazyWithRetry(() => import('./pages/AgenticAIPage'));
const AgentOrchestrationPage = lazyWithRetry(() => import('./pages/AgentOrchestrationPage'));
const Documentation = lazyWithRetry(() => import('./pages/Documentation'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const DocumentationCrawl = lazyWithRetry(() => import('./pages/DocumentationCrawl'));
const CrawledData = lazyWithRetry(() => import('./pages/CrawledData'));
const UIComponentsDemo = lazyWithRetry(() => import('./pages/UIComponentsDemo'));
const ProfileSettings = lazyWithRetry(() => import('./pages/Settings/ProfileSettings'));
const AppearanceSettings = lazyWithRetry(() => import('./pages/Settings/AppearanceSettings'));
const SecuritySettings = lazyWithRetry(() => import('./pages/Settings/SecuritySettings'));
const NotificationSettings = lazyWithRetry(() => import('./pages/Settings/NotificationSettings'));
const ApiSettings = lazyWithRetry(() => import('./pages/Settings/ApiSettings'));
const UserManagement = lazyWithRetry(() => import('./pages/Settings/UserManagement'));
const CategoriesSettings = lazyWithRetry(() => import('./pages/Settings/CategoriesSettings'));
const DataMaintenanceSettings = lazyWithRetry(() => import('./pages/Settings/DataMaintenanceSettings'));

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

  // Don't show sidebar/navbar on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
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
          <Suspense fallback={<LoadingScreen />}>
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
              <Route path="/settings/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
              <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
              <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
              <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
              <Route path="/settings/api" element={<ProtectedRoute><ApiSettings /></ProtectedRoute>} />
              <Route path="/settings/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/settings/categories" element={<ProtectedRoute><CategoriesSettings /></ProtectedRoute>} />
              <Route path="/settings/data" element={<ProtectedRoute requiredRole="admin"><DataMaintenanceSettings /></ProtectedRoute>} />

              {/* Fallbacks */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
