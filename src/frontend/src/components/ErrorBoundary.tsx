import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Check if this is a chunk loading error (common on mobile/after deployments)
    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';

    const isChunkError =
      name === 'chunkloaderror' ||
      message.includes('failed to fetch dynamically imported module') ||
      message.includes('importing a module script failed') ||
      message.includes('module script failed') ||
      message.includes('loading chunk') ||
      message.includes('loading css chunk') ||
      message.includes('failed to fetch') ||
      // Safari/mobile specific patterns
      (error.name === 'TypeError' && message.includes('module'));

    return { hasError: true, error, errorInfo: null, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  handleRefresh = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { isChunkError, error, errorInfo } = this.state;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
        }}>
          <h1 style={{ color: isChunkError ? '#f59e0b' : '#ef4444', marginBottom: '1rem' }}>
            {isChunkError ? 'Update Available' : 'Something went wrong'}
          </h1>
          <p style={{ marginBottom: '1rem', maxWidth: '500px' }}>
            {isChunkError
              ? 'A new version of the app is available. Please refresh to get the latest version.'
              : 'The application encountered an error. Please try refreshing the page.'}
          </p>
          {!isChunkError && error && (
            <pre style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '1rem',
              borderRadius: '8px',
              maxWidth: '100%',
              overflow: 'auto',
              fontSize: '0.875rem',
              textAlign: 'left',
              marginBottom: '1rem',
            }}>
              {error.toString()}
              {errorInfo && (
                <>
                  {'\n\nComponent Stack:'}
                  {errorInfo.componentStack}
                </>
              )}
            </pre>
          )}
          <button
            onClick={this.handleRefresh}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: isChunkError ? '#f59e0b' : '#3b82f6',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            {isChunkError ? 'Refresh Now' : 'Refresh Page'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
