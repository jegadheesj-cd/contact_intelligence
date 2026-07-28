import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', type = 'text', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5 mb-4">
        {label && (
          <label className="text-xs font-bold text-slate-600 dark:text-zinc-450 tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            ref={ref}
            className={`w-full px-3.5 py-2 text-sm bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 border rounded-lg outline-none transition-all duration-150 focus:ring-2
              ${error 
                ? 'border-rose-450 focus:border-rose-500 focus:ring-rose-100 dark:focus:ring-rose-950/30' 
                : 'border-slate-200 dark:border-zinc-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-indigo-100 dark:focus:ring-indigo-950/40'
              } ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs font-medium text-rose-500 flex items-center gap-1 mt-0.5 animate-slide-down">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
