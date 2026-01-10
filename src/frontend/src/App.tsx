import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from './hooks/useAuth';

// Pages
import Dashboard from './pages/Dashboard';
import ScriptManagement from './pages/ScriptManagement';
import ScriptDetail from './pages/ScriptDetail';
import ScriptEditor from './pages/ScriptEditor';
import ScriptAnalysis from './pages/ScriptAnalysis';
import SimpleChatWithAI from './pages/SimpleChatWithAI';
import Documentation from './pages/Documentation';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import ChatHistory from './pages/ChatHistory';
import DocumentationCrawl from './pages/DocumentationCrawl';
import ScriptUpload from './pages/ScriptUpload';
import AgenticAIPage from './pages/AgenticAIPage';
import AgentOrchestrationPage from './pages/AgentOrchestrationPage';
import UIComponentsDemo from './pages/UIComponentsDemo';
import Analytics from './pages/Analytics';

// Settings Pages
import ProfileSettings from './pages/Settings/ProfileSettings';
import AppearanceSettings from './pages/Settings/AppearanceSettings';
import SecuritySettings from './pages/Settings/SecuritySettings';
import NotificationSettings from './pages/Settings/NotificationSettings';
import ApiSettings from './pages/Settings/ApiSettings';
import UserManagement from './pages/Settings/UserManagement';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';

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
  const { user } = useAuth();
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
      <Router>
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
                <Route path="/ui-components" element={<UIComponentsDemo />} />
                
                {/* Settings */}
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/settings/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
                <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
                <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
                <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
                <Route path="/settings/api" element={<ProtectedRoute><ApiSettings /></ProtectedRoute>} />
                <Route path="/settings/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
                
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
