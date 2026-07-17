import React from 'react';

interface LoaderProps {
  fullScreen?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Loader: React.FC<LoaderProps> = ({
  fullScreen = false,
  message = 'Loading...',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-4',
    lg: 'h-16 w-16 border-4',
  };

  const containerStyle = fullScreen
    ? 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4'
    : 'flex flex-col items-center justify-center gap-2 p-6';

  return (
    <div className={containerStyle}>
      <div className={`animate-spin rounded-full border-indigo-200 border-t-indigo-600 ${sizeClasses[size]}`} />
      {message && (
        <span className={`text-sm font-semibold ${fullScreen ? 'text-white' : 'text-slate-500'}`}>
          {message}
        </span>
      )}
    </div>
  );
};
