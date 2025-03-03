import React, { lazy, Suspense } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';

// Import SimpleChatWithAI directly to avoid lazy loading issues
import SimpleChatWithAI from './pages/SimpleChatWithAI';
import Dashboard from './pages/Dashboard';
import ModernDashboard from './pages/ModernDashboard';
import Settings from './pages/Settings/Settings';
import ApplicationSettings from './pages/Settings/ApplicationSettings';
import ProfileSettings from './pages/Settings/ProfileSettings';
import EnhancedScriptUpload from './pages/EnhancedScriptUpload';
import Layout from './components/Layout';
import Loading from './components/Loading';
// DbToggle removed

// Import providers
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';

// Lazy load other pages
const ChatHistory = lazy(() => import('./pages/ChatHistory'));
const Login = lazy(() => import('./pages/Login'));
const ScriptManagement = lazy(() => import('./pages/ScriptManagement'));
const ManageFiles = lazy(() => import('./pages/ManageFiles'));

// Simpler layout just for the chat page
const SimpleLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};

// Create a component for SimpleChatWithAI route
const ChatPage = () => {
  return (
    <SimpleLayout>
      <SimpleChatWithAI />
    </SimpleLayout>
  );
};

// Create a QueryClient 
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      cacheTime: 300000, // 5 minutes
    },
  },
});

// NotFound component for fallback routes
const NotFound = () => {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-xl mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <a href="/chat" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Return to Chat
        </a>
      </div>
    </Layout>
  );
};

// Fallback component for scripts detail page
const ScriptFallback = () => {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Script Feature Not Available</h1>
        <p className="text-lg mb-6">The script viewing feature is not fully implemented in this demo.</p>
        <p className="mb-8">You can continue using the chat feature to get help with PowerShell scripts.</p>
        <a href="/chat" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Return to Chat
        </a>
      </div>
    </Layout>
  );
};

// Dashboard component with Layout
const DashboardPage = () => {
  return (
    <Layout>
      <ModernDashboard />
    </Layout>
  );
};

// Main app
const App: React.FC = () => {
  // Debug initialization
  console.log('DEBUG: App - Initializing application');  
  
  // Debug route rendering
  const logRouteRender = (routeName: string) => {
    console.log(`DEBUG: App - ${routeName} route rendered`);
    return null;
  };
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {/* Log providers initialization */}
          {logRouteRender('Providers initialized')}
          <Router>
            {/* Log router initialization */}
            {logRouteRender('Router initialized')}
            <Suspense fallback={<Loading />}>
              <Routes>
                {/* Log routes definition */}
                {logRouteRender('Routes defined')}
                <Route path='/chat' element={<ChatPage />} />
                <Route path='/chat/history' element={<ChatHistory />} />
                <Route path='/login' element={<Login />} />
                <Route path='/dashboard' element={<DashboardPage />} />
                <Route path='/settings' element={
                  <Layout>
                    {logRouteRender('Settings route rendered')}
                    <Settings />
                  </Layout>
                } />
                <Route path='/settings/application' element={
                  <Layout>
                    {logRouteRender('Application Settings route rendered')}
                    <ApplicationSettings />
                  </Layout>
                } />
                <Route path='/settings/profile' element={
                  <Layout>
                    {logRouteRender('Profile Settings route rendered')}
                    <ProfileSettings />
                  </Layout>
                } />
                <Route path='/scripts' element={
                  <Layout>
                    {logRouteRender('Scripts route rendered')}
                    <ScriptManagement />
                  </Layout>
                } />
                <Route path='/scripts/manage' element={
                  <Layout>
                    {logRouteRender('Scripts manage route rendered')}
                    <ManageFiles />
                  </Layout>
                } />
                <Route path='/scripts/upload' element={
                  <Layout>
                    {logRouteRender('Script Upload route rendered')}
                    <EnhancedScriptUpload />
                  </Layout>
                } />
                <Route path='/scripts/:id' element={<ScriptFallback />} />
                <Route path='/' element={<Navigate to='/dashboard' replace />} />
                <Route path='*' element={<NotFound />} />
              </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
