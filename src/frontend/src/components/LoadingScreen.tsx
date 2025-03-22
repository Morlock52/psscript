import React from 'react';
import { useTheme } from '../hooks/useTheme';

// Define props for LoadingScreen
interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading PSScript...' 
}) => {
  const { theme } = useTheme();
  
  return (
    <div 
      className={`fixed inset-0 flex flex-col items-center justify-center ${
        theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
      }`}
    >
      {/* Logo */}
      <div className="mb-8">
        <div className={`text-4xl font-bold ${
          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
        }`}>
          PSScript
        </div>
        <div className={`text-sm mt-1 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          AI-Powered PowerShell Script Management
        </div>
      </div>
      
      {/* Loading Animation */}
      <div className="flex space-x-2 mb-4">
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-150"></div>
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-300"></div>
      </div>
      
      {/* Loading Message */}
      <p className={`text-sm ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      }`}>
        {message}
      </p>
    </div>
  );
};

export default LoadingScreen;
