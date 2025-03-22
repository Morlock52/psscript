import React from 'react';
import { useTheme } from '../hooks/useTheme';

// Define props for LoadingSpinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md',
  color = 'blue',
  className = ''
}) => {
  const { theme } = useTheme();
  
  // Determine size class
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }[size];
  
  // Determine color class based on theme and color prop
  const colorClass = {
    blue: theme === 'dark' ? 'text-blue-500' : 'text-blue-600',
    green: theme === 'dark' ? 'text-green-500' : 'text-green-600',
    red: theme === 'dark' ? 'text-red-500' : 'text-red-600',
    yellow: theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600',
    gray: theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
  }[color];
  
  return (
    <div className={`inline-block ${className}`} role="status" aria-label="loading">
      <svg 
        className={`animate-spin ${sizeClass} ${colorClass}`} 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        ></circle>
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  );
};

export default LoadingSpinner;
