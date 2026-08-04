import React, { useState } from 'react';
import { useFaceHistory } from '../../../hooks/useFace';
import { Loader } from '../../../components/Loader';
import { Button } from '../../../components/Button';
import { Search, Clock, CheckCircle, XCircle, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FaceHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  
  const limit = 10;
  const { data, isLoading, isError } = useFaceHistory(page, limit, statusFilter, providerFilter);

  const handleNextPage = () => {
    if (data?.page < data?.totalPages) setPage(p => p + 1);
  };
  const handlePrevPage = () => {
    if (page > 1) setPage(p => p - 1);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'SUCCESS_LOCAL_ONLY': return <CheckCircle className="h-5 w-5 text-indigo-500" />;
      case 'FAILED': return <AlertTriangle className="h-5 w-5 text-rose-500" />;
      case 'NO_MATCH': return <XCircle className="h-5 w-5 text-slate-400" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const serverBase = import.meta.env.VITE_API_BASE_URL.replace('/api', '');

  const getImageUrl = (uploadedImage: string) => {
    if (!uploadedImage) return '';
    let cleanPath = uploadedImage.replace(/\\/g, '/');
    if (cleanPath.startsWith('ci_backend/')) {
      cleanPath = cleanPath.substring('ci_backend/'.length);
    }
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    return `${serverBase}${cleanPath}`;
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Face Search History</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            Review past biometric OSINT searches
          </p>
        </div>
        <div className="flex gap-3">
          <select 
            value={statusFilter} 
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-600 focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success (OSINT)</option>
            <option value="SUCCESS_LOCAL_ONLY">Success (Local)</option>
            <option value="NO_MATCH">No Match</option>
            <option value="FAILED">Failed</option>
          </select>
          <select 
            value={providerFilter} 
            onChange={e => { setProviderFilter(e.target.value); setPage(1); }}
            className="text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-600 focus:border-indigo-500"
          >
            <option value="">All Providers</option>
            <option value="azure">Azure AI</option>
            <option value="pimeyes">PimEyes</option>
            <option value="None">None</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <Loader message="Loading search history..." size="md" />
        </div>
      ) : isError ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-rose-500 min-h-[300px] flex items-center justify-center">
          Failed to load history. Please try again.
        </div>
      ) : data?.items?.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="p-4 bg-slate-50 rounded-full mb-4">
            <Search className="h-10 w-10 text-slate-300" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No History Found</h2>
          <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
            There are no past searches matching your current filters. 
          </p>
          <Button onClick={() => navigate('/face-match')} className="mt-6 text-xs px-6">
            Start New Search
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provider</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidates</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confidence</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time (ms)</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                       {getStatusIcon(item.status)}
                      <span className="text-xs font-bold text-slate-700">{item.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-10 w-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center relative">
                       <ImageIcon className="h-4 w-4 text-slate-400 absolute" />
                       {item.uploadedImage && (
                         <img 
                           src={getImageUrl(item.uploadedImage)} 
                           className="h-full w-full object-cover absolute inset-0 z-10 bg-slate-100 animate-fade-in" 
                           alt="Search query" 
                           onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                         />
                       )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{item.providerUsed}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-bold text-slate-700">{item.candidateCount}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-bold text-slate-700">{item.confidence}%</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-medium text-slate-500">{item.processingTime}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-medium text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="py-4 px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Page {data.page} of {data.totalPages} (Total: {data.total})
            </span>
            <div className="flex gap-2">
              <Button onClick={handlePrevPage} disabled={page === 1} variant="outline" className="text-xs px-3 py-1.5">
                Previous
              </Button>
              <Button onClick={handleNextPage} disabled={page === data.totalPages} variant="outline" className="text-xs px-3 py-1.5">
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
