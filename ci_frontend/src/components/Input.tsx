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
          <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            ref={ref}
            className={`w-full px-3.5 py-2 text-sm bg-white border rounded-lg outline-none transition-all duration-150 focus:ring-2 focus:bg-slate-50/20
              ${error 
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' 
                : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
              } ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs font-medium text-rose-500 flex items-center gap-1 mt-0.5 animate-slide-down">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-400 mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
