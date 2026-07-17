import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const btnVariants = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    primary: 'primary' as const,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
      />

      {/* Modal Dialog Body */}
      <div className="bg-white border border-slate-100 shadow-xl rounded-2xl w-full max-w-sm p-6 relative z-10 animate-slide-down flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 outline-none transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Warning Icon Banner */}
        <div className={`p-3 rounded-full mb-4 inline-flex items-center justify-center
          ${variant === 'danger' ? 'bg-rose-50 border border-rose-100 text-rose-500' : 'bg-amber-50 border border-amber-100 text-amber-500'}`}
        >
          <AlertTriangle className="h-6 w-6 shrink-0" />
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-[280px]">
          {message}
        </p>

        {/* Footer Actions */}
        <div className="flex gap-3 w-full">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isLoading}
            className="flex-1 py-2 text-xs"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant={btnVariants[variant]}
            isLoading={isLoading}
            className="flex-1 py-2 text-xs font-bold"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
