import React from 'react';

// Define props for LoadingScreen
interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading PSScript...'
}) => {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
    >
      {/* Logo */}
      <div className="mb-8">
        <div className="text-4xl font-bold text-[var(--color-primary)]">
          PSScript
        </div>
        <div className="text-sm mt-1 text-[var(--color-text-secondary)]">
          AI-Powered PowerShell Script Management
        </div>
      </div>

      {/* Loading Animation */}
      <div className="flex space-x-2 mb-4">
        <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full animate-bounce delay-150"></div>
        <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full animate-bounce delay-300"></div>
      </div>

      {/* Loading Message */}
      <p className="text-sm text-[var(--color-text-secondary)]">
        {message}
      </p>
    </div>
  );
};

export default LoadingScreen;
