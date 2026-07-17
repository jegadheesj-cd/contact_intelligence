import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { useToastStore } from '../../../store/useToastStore';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      organization: '',
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setApiError(null);
    try {
      // Map name -> fullName and pass organization optionally to match backend register schema
      await api.post('/auth/register', {
        fullName: data.name,
        email: data.email,
        password: data.password,
        organization: data.organization || null,
      });

      addToast('Account created successfully! Please sign in.', 'success');
      navigate('/login', { replace: true, state: { registerSuccess: true } });
    } catch (err: any) {
      const errorMsg = err.message || 'Registration failed. Please check your inputs.';
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
          Create a new account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-medium">
          Or{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
            sign in to your account
          </Link>
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

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            error={errors.name?.message}
            {...register('name', {
              required: 'Full name is required',
              minLength: {
                value: 2,
                message: 'Name must be at least 2 characters long',
              },
            })}
          />

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

          <Input
            label="Organization (Optional)"
            type="text"
            placeholder="Innovate Tech"
            error={errors.organization?.message}
            {...register('organization')}
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters long',
                },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-9.5 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button type="submit" isLoading={loading} className="w-full mt-4 py-2.5">
            Sign Up
          </Button>
        </form>
      </div>
    </div>
  );
};
