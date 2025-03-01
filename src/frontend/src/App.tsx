import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';

// Lazy-loaded Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ScriptDetail = lazy(() => import('./pages/ScriptDetail'));
const ScriptUpload = lazy(() => import('./pages/ScriptUpload'));
const ScriptManagement = lazy(() => import('./pages/ScriptManagement'));
const ManageFiles = lazy(() => import('./pages/ManageFiles'));
const Search = lazy(() => import('./pages/Search'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Settings Pages
const Settings = lazy(() => import('./pages/Settings/Settings'));
const ApplicationSettings = lazy(() => import('./pages/Settings/ApplicationSettings'));
const ProfileSettings = lazy(() => import('./pages/Settings/ProfileSettings'));
const AppearanceSettings = lazy(() => import('./pages/Settings/AppearanceSettings'));
const SecuritySettings = lazy(() => import('./pages/Settings/SecuritySettings'));
const NotificationSettings = lazy(() => import('./pages/Settings/NotificationSettings'));
const ApiSettings = lazy(() => import('./pages/Settings/ApiSettings'));

// Components
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Create React Query client with stale time for better caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      cacheTime: 900000, // 15 minutes
    },
  },
});

// Loading component for suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// App component with routes
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      } />
      <Route path="/register" element={
        <Suspense fallback={<PageLoader />}>
          <Register />
        </Suspense>
      } />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        } />
        <Route path="scripts">
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <Search />
            </Suspense>
          } />
          <Route path="upload" element={
            <Suspense fallback={<PageLoader />}>
              <ScriptUpload />
            </Suspense>
          } />
          <Route path="manage" element={
            <Navigate to="/manage-files" replace />
          } />
          <Route path=":id" element={
            <Suspense fallback={<PageLoader />}>
              <ScriptDetail />
            </Suspense>
          } />
          <Route path=":id/edit" element={
            <Suspense fallback={<PageLoader />}>
              <ScriptDetail />
            </Suspense>
          } />
        </Route>
        <Route path="manage-files" element={
          <Suspense fallback={<PageLoader />}>
            <ManageFiles />
          </Suspense>
        } />
        <Route path="analytics" element={
          <Suspense fallback={<PageLoader />}>
            <Analytics />
          </Suspense>
        } />
        <Route path="settings">
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          } />
          <Route path="application" element={
            <Suspense fallback={<PageLoader />}>
              <ApplicationSettings />
            </Suspense>
          } />
          <Route path="profile" element={
            <Suspense fallback={<PageLoader />}>
              <ProfileSettings />
            </Suspense>
          } />
          <Route path="appearance" element={
            <Suspense fallback={<PageLoader />}>
              <AppearanceSettings />
            </Suspense>
          } />
          <Route path="security" element={
            <Suspense fallback={<PageLoader />}>
              <SecuritySettings />
            </Suspense>
          } />
          <Route path="notifications" element={
            <Suspense fallback={<PageLoader />}>
              <NotificationSettings />
            </Suspense>
          } />
          <Route path="api" element={
            <Suspense fallback={<PageLoader />}>
              <ApiSettings />
            </Suspense>
          } />
        </Route>
      </Route>
      
      <Route path="*" element={
        <Suspense fallback={<PageLoader />}>
          <NotFound />
        </Suspense>
      } />
    </Routes>
  );
};

// Main app with providers
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;