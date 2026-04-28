import React from 'react';
import BrandMark from './BrandMark';

// Define props for LoadingScreen
interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading PSScript...'
}) => {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--surface-base)] text-[var(--ink-primary)]"
    >
      <div className="mb-8">
        <BrandMark size="lg" />
        <div className="mt-3 text-center text-sm text-[var(--ink-secondary)]">
          AI-powered PowerShell command center
        </div>
      </div>

      {/* Loading Animation */}
      <div className="flex space-x-2 mb-4">
        <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce delay-150"></div>
        <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce delay-300"></div>
      </div>

      {/* Loading Message */}
      <p className="text-sm text-[var(--ink-secondary)]">
        {message}
      </p>
    </div>
  );
};

export default LoadingScreen;
