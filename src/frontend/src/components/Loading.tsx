import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-screen bg-[var(--color-bg-primary)]">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-primary)] mb-4"></div>
        <h3 className="text-xl font-medium text-[var(--color-text-primary)]">Loading...</h3>
        <p className="text-[var(--color-text-tertiary)]">Please wait while we prepare your content</p>
      </div>
    </div>
  );
};

export default Loading;
