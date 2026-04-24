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
      className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_70%_65%,rgba(34,197,94,0.12),transparent_32%)]" />
      {/* Logo */}
      <div className="relative mb-8">
        <BrandMark size="lg" showWordmark stacked />
        <div className="text-sm mt-3 text-[var(--color-text-secondary)]">
          AI-Powered PowerShell Script Management
        </div>
      </div>

      {/* Loading Animation */}
      <div className="relative flex space-x-2 mb-4">
        <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-[var(--color-accent)] rounded-full animate-bounce delay-150"></div>
        <div className="w-3 h-3 bg-[var(--color-warning)] rounded-full animate-bounce delay-300"></div>
      </div>

      {/* Loading Message */}
      <p className="relative text-sm text-[var(--color-text-secondary)]">
        {message}
      </p>
    </div>
  );
};

export default LoadingScreen;
