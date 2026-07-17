import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldQuestion, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border border-slate-100 shadow-xl shadow-slate-100/50 rounded-2xl p-8 flex flex-col items-center">
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-full inline-flex items-center justify-center mb-6">
          <ShieldQuestion className="h-12 w-12 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Page Not Found</h1>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm shadow-indigo-100 text-sm transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Go back home
        </Link>
      </div>
    </div>
  );
};
