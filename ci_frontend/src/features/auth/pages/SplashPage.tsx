import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { ShieldCheck } from 'lucide-react';

export const SplashPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white select-none">
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="p-5 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <ShieldCheck className="h-16 w-16 text-indigo-500" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            Contact Intelligence
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium tracking-widest uppercase">
            Platform Engine
          </p>
        </div>
      </div>
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full w-full bg-indigo-50 origin-left animate-[loading_1.5s_ease-in-out_infinite]" />
        </div>
        <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">
          Initializing secure environment
        </span>
      </div>
    </div>
  );
};
