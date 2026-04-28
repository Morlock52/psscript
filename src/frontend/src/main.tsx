// Self-hosted font faces — loaded once for the entire app.
// DM Serif Display is NOT imported here; the BrandShell lazy-loads it
// only when a brand-surface route mounts (Phase E task E5).
import '@fontsource-variable/mona-sans';
import '@fontsource-variable/jetbrains-mono';

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import 'monaco-editor/min/vs/editor/editor.main.css'
import './index.css'

const showStartupError = (error: unknown) => {
  const loading = document.getElementById('app-loading');
  const errorDiv = document.getElementById('app-error');
  const errorDetails = document.getElementById('error-details');

  if (loading) loading.style.display = 'none';
  if (errorDiv) errorDiv.classList.add('visible');
  if (errorDetails) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    errorDetails.textContent = `Startup error:\n${message}`;
  }
};

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Missing #root element');
  }

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  const loadingElement = document.getElementById('app-loading');
  if (loadingElement) {
    requestAnimationFrame(() => {
      loadingElement.style.display = 'none';
    });
  }
} catch (error) {
  showStartupError(error);
}
