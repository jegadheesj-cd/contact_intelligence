import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useToastStore } from '../../../store/useToastStore';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { ShieldCheck, MailCheck, ArrowLeft, AlertCircle } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [isSent, setIsSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setApiError(null);
    try {
      // Connect to the backend forgotPassword API endpoint
      await api.post('/auth/forgot-password', {
        email: data.email,
      });
      setIsSent(true);
      addToast('Reset instructions sent to your email address.', 'success');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to submit reset request. Please try again.';
      setApiError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="p-3 bg-indigo-600/10 border border-indigo-500/10 rounded-xl mb-4">
          <ShieldCheck className="h-10 w-10 text-indigo-600" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-medium">
          Enter your email to receive recovery instructions.
        </p>
      </div>

      <div className="bg-white py-8 px-6 shadow-md shadow-slate-100/50 border border-slate-100 sm:rounded-xl sm:px-10">
        {apiError && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs font-semibold text-rose-700 leading-normal">
              {apiError}
            </div>
          </div>
        )}

        {isSent ? (
          <div className="text-center py-4">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-full inline-flex items-center justify-center mb-4">
              <MailCheck className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Check your email</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              We have sent a password recovery link to your email address if it is registered in our database.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Email Address"
              type="email"
              placeholder="name@enterprise.com"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email address is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address format',
                },
              })}
            />

            <Button type="submit" isLoading={loading} className="w-full mt-4 py-2.5">
              Send Recovery Link
            </Button>

            <div className="text-center mt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
