import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from './hooks/useAuth';
import { isAuthDisabledForCurrentHost } from './services/supabase';
import lazyWithRetry from './utils/lazyWithRetry';
import VoiceAssistantDock from './components/VoiceAssistantDock';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import { BrandShell, OperatorShell } from './components/layouts';

const Login = lazyWithRetry(() => import('./pages/Login'));
const AuthCallback = lazyWithRetry(() => import('./pages/AuthCallback'));
const PendingApproval = lazyWithRetry(() => import('./pages/PendingApproval'));
const Register = lazyWithRetry(() => import('./pages/Register'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const ScriptManagement = lazyWithRetry(() => import('./pages/ScriptManagement'));
const ScriptUpload = lazyWithRetry(() => import('./pages/ScriptUpload'));
const ScriptDetail = lazyWithRetry(() => import('./pages/ScriptDetail'));
const ScriptEditor = lazyWithRetry(() => import('./pages/ScriptEditor'));
const ScriptAnalysis = lazyWithRetry(() => import('./pages/ScriptAnalysis'));
const Search = lazyWithRetry(() => import('./pages/Search'));
const Categories = lazyWithRetry(() => import('./pages/Categories'));
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
const DocumentationSettings = lazyWithRetry(() => import('./pages/Settings/DocumentationSettings'));

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
  const disableAuth = isAuthDisabledForCurrentHost();

  // When auth is disabled in local dev, avoid a "bounce" to /login (and confusing demo-login UX).
  if (disableAuth) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user?.isEnabled === false) {
    return <Navigate to="/pending-approval" replace />;
  }

  return user ? <Dashboard /> : <Navigate to="/login" replace />;
};

// Layout wrapper that conditionally shows navigation
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  // Brand-surface routes get BrandShell (Aurora glow + lazy DM Serif Display).
  const isBrandRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/auth/callback' ||
    location.pathname === '/pending-approval' ||
    location.pathname === '/404';

  if (isBrandRoute) {
    return <BrandShell>{children}</BrandShell>;
  }

  if (!isLoading && user?.isEnabled === false) {
    return <Navigate to="/pending-approval" replace />;
  }

  return (
    <OperatorShell>
      {children}
      <VoiceAssistantDock />
    </OperatorShell>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastContainer position="top-right" theme="colored" />
        <AppLayout>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />

              {/* Script Management */}
              <Route path="/scripts" element={<ProtectedRoute><ScriptManagement /></ProtectedRoute>} />
              <Route path="/scripts/upload" element={<ProtectedRoute><ScriptUpload /></ProtectedRoute>} />
              <Route path="/scripts/:id" element={<ProtectedRoute><ScriptDetail /></ProtectedRoute>} />
              <Route path="/scripts/:id/edit" element={<ProtectedRoute requiredRole="admin"><ScriptEditor /></ProtectedRoute>} />
              <Route path="/scripts/:id/analysis" element={<ProtectedRoute><ScriptAnalysis /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
              <Route path="/categories/:id" element={<ProtectedRoute><Categories /></ProtectedRoute>} />

              {/* AI Features */}
              <Route path="/chat" element={<ProtectedRoute><SimpleChatWithAI /></ProtectedRoute>} />
              <Route path="/chat/history" element={<ProtectedRoute><ChatHistory /></ProtectedRoute>} />
              <Route path="/ai/assistant" element={<ProtectedRoute><AgenticAIPage /></ProtectedRoute>} />
              <Route path="/agentic" element={<Navigate to="/ai/assistant" replace />} />
              <Route path="/agentic-ai" element={<Navigate to="/ai/assistant" replace />} />
              <Route path="/ai/agentic" element={<Navigate to="/ai/assistant" replace />} />
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
              <Route path="/settings/docs" element={<ProtectedRoute><DocumentationSettings /></ProtectedRoute>} />
              <Route path="/settings/users" element={<ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute>} />
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
