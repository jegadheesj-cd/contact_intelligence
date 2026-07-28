import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const loginUser = useAuthStore((state) => state.login);
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
      email: '',
      password: '',
    },
  });

  // Display toast notice if user was redirected from a successful registration
  useEffect(() => {
    if (location.state?.registerSuccess) {
      addToast('Registration successful! Please sign in with your credentials.', 'success', 4000);
      // Clear navigation state to prevent duplicate toasts on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location, addToast]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
      });

      // Correctly access data envelope from the backend response wrapper
      const { accessToken, refreshToken, user } = response.data.data;
      loginUser(user, accessToken, refreshToken);
      addToast(`Welcome back, ${user.fullName || user.name}!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const errorMsg = err.message || 'Login failed. Please check your credentials.';
      setApiError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="flex flex-col items-center justify-center mb-6 animate-slide-up">
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-4 shadow-lg shadow-indigo-500/5">
          <ShieldCheck className="h-10 w-10 text-indigo-400" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400 font-medium">
          Or{' '}
          <Link to="/register" className="font-bold text-indigo-400 hover:text-indigo-350 transition-colors">
            create a new account
          </Link>
        </p>
      </div>
 
      <div className="bg-zinc-900/40 backdrop-blur-md py-8 px-6 border border-zinc-800/80 sm:rounded-2xl sm:px-10 shadow-2xl shadow-zinc-950/60 animate-slide-up delay-75">
        {apiError && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs font-semibold text-rose-300 leading-normal">
              {apiError}
            </div>
          </div>
        )}
 
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
              className="absolute right-3.5 top-9.5 text-zinc-500 hover:text-zinc-300 focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
 
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500/20 border-zinc-800 bg-zinc-950 rounded cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-xs font-bold text-zinc-400 select-none cursor-pointer">
                Remember me
              </label>
            </div>
 
            <div className="text-xs">
              <Link to="/forgot-password" className="font-bold text-indigo-400 hover:text-indigo-350">
                Forgot password?
              </Link>
            </div>
          </div>
 
          <Button type="submit" isLoading={loading} className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-550 border-0 text-white font-bold transition-all shadow-md shadow-indigo-650/10">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};
