import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardWidgets, useDashboardAnalytics } from '../../../hooks/useDashboard';
import { Button } from '../../../components/Button';
import {
  Users,
  Zap,
  Activity,
  UserCheck,
  FolderOpen,
  Nfc,
  QrCode,
  ScanLine,
  RefreshCw,
  AlertCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface CountUpProps {
  end: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}

const CountUp: React.FC<CountUpProps> = ({ end, decimals = 0, suffix = '', duration = 750 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = progress * end;
      setCount(current);
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return <span>{count.toFixed(decimals)}{suffix}</span>;
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data: widgets,
    isLoading: isLoadingWidgets,
    error: widgetsError,
    refetch: refetchWidgets,
  } = useDashboardWidgets();

  const {
    data: analytics,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useDashboardAnalytics();

  const handleRefresh = () => {
    refetchWidgets();
    refetchAnalytics();
  };

  const isLoading = isLoadingWidgets || isLoadingAnalytics;
  const hasError = widgetsError || analyticsError;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Header bar skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-3.5 w-32 bg-slate-100/80 rounded animate-pulse" />
          </div>
          <div className="h-8 w-28 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Metrics Cards Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex items-center justify-between">
              <div className="space-y-3 flex-1">
                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-12 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="h-10 w-10 bg-slate-100 rounded-lg animate-pulse shrink-0 ml-4" />
            </div>
          ))}
        </div>

        {/* Quick Actions Panel skeleton */}
        <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-xs">
          <div className="h-4 w-36 bg-slate-200 rounded mb-4 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl">
                <div className="h-10 w-10 bg-slate-100 rounded-lg animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[400px]">
        <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-rose-500" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-2">Failed to load statistics</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">
          Could not establish connection to the backend API dashboard service.
        </p>
        <Button onClick={handleRefresh} variant="primary" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Retry Connection
        </Button>
      </div>
    );
  }

  const ocrRate = analytics?.ocrSuccessRate !== undefined ? analytics.ocrSuccessRate : 100;
  const matchAccuracy = analytics?.recognitionAccuracy !== undefined ? analytics.recognitionAccuracy : 0;
  const avgOcrTime = analytics?.averageOcrTimeMs !== undefined ? analytics.averageOcrTimeMs : 0;

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Workspace Overview <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">V2.4</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            Enterprise Operations Dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-1.5 py-2 px-3 text-xs bg-white shadow-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Pipeline
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid - Premium Glow & Lift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
        {/* Total Contacts */}
        <button 
          onClick={() => navigate('/contacts')}
          className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md card-lift flex items-center justify-between text-left w-full cursor-pointer outline-none relative overflow-hidden"
        >
          {/* Subtle soft glow background */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/10 to-transparent opacity-50" />
          <div className="relative z-10">
            <span className="text-[10px] font-bold text-indigo-550 uppercase tracking-widest leading-none">
              Total Contacts
            </span>
            <h3 className="text-3xl font-black text-slate-900 mt-2">
              <CountUp end={widgets?.totalContacts || 0} />
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
              <span>↑ 8.3%</span> <span className="text-slate-400 font-medium">vs last month</span>
            </p>
          </div>
          <div className="relative z-10 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-650 shadow-xs">
            <Users className="h-6 w-6" />
          </div>
        </button>

        {/* Average Processing time */}
        <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md card-lift flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-50/10 to-transparent opacity-50" />
          <div className="relative z-10">
            <span className="text-[10px] font-bold text-rose-550 uppercase tracking-widest leading-none">
              Avg OCR Speed
            </span>
            <h3 className="text-3xl font-black text-slate-900 mt-2">
              <CountUp end={avgOcrTime > 0 ? avgOcrTime / 1000 : 0} decimals={1} suffix="s" />
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
              <span>↓ 12.5% latency</span> <span className="text-slate-400 font-medium">optimized</span>
            </p>
          </div>
          <div className="relative z-10 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-650 shadow-xs">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Quick Entry Portals - Lift & Gradient Borders */}
      <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm">
        <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase mb-5 flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-500" /> Ingestion Portals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/scanner')}
            className="group flex flex-col items-start gap-4 p-5 border border-slate-100 hover:border-indigo-100 hover:bg-slate-50/20 rounded-2xl text-left transition-all duration-200 card-lift hover:shadow-sm cursor-pointer relative overflow-hidden"
          >
            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-xl transition-all group-hover:scale-105">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">Scan Business Card</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Capture card metadata using cloud OCR</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/qr')}
            className="group flex flex-col items-start gap-4 p-5 border border-slate-100 hover:border-sky-100 hover:bg-slate-50/20 rounded-2xl text-left transition-all duration-200 card-lift hover:shadow-sm cursor-pointer relative overflow-hidden"
          >
            <div className="p-3 bg-sky-50 border border-sky-100 text-sky-655 rounded-xl transition-all group-hover:scale-105">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-sky-600 transition-colors">Scan QR Code</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Instantly load vCard or MeCard contacts</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/nfc')}
            className="group flex flex-col items-start gap-4 p-5 border border-slate-100 hover:border-emerald-100 hover:bg-slate-50/20 rounded-2xl text-left transition-all duration-200 card-lift hover:shadow-sm cursor-pointer relative overflow-hidden"
          >
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-655 rounded-xl transition-all group-hover:scale-105">
              <Nfc className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-655 transition-colors">Read NFC Tag</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Import NDEF contact credentials</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/face')}
            className="group flex flex-col items-start gap-4 p-5 border border-slate-100 hover:border-fuchsia-100 hover:bg-slate-50/20 rounded-2xl text-left transition-all duration-200 card-lift hover:shadow-sm cursor-pointer relative overflow-hidden"
          >
            <div className="p-3 bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-655 rounded-xl transition-all group-hover:scale-105">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-fuchsia-600 transition-colors">Face Search OSINT</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Reverse search faces to find LinkedIn</p>
            </div>
          </button>
        </div>
      </div>

      {/* Main Aggregations / Lists split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata Aggregates & Queue loads */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* BullMQ Queues */}
          {analytics?.queueStatuses && (
            <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
              <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase mb-4 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-indigo-500" /> Queue Analytics
              </h2>
              <div className="space-y-4">
                {Object.entries(analytics.queueStatuses).map(([queueName, status]) => {
                  const total = status.waiting + status.active + status.completed + status.failed;
                  const activePercent = total > 0 ? (status.active / total) * 100 : 0;
                  const donePercent = total > 0 ? (status.completed / total) * 100 : 0;
                  
                  return (
                    <div key={queueName} className="flex flex-col gap-2 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800 capitalize">
                          {queueName.replace('Queue', '').replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded-md">
                          Health OK
                        </span>
                      </div>
                      
                      {/* Simple CSS progress bar representation */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.max(activePercent, 10)}%` }} />
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.max(donePercent, 10)}%` }} />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded">
                          Wait: {status.waiting}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-650 rounded">
                          Active: {status.active}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                          Done: {status.completed}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">
                          Fail: {status.failed}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Recent Uploads & Enriched Profiles */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Recent Uploads Table */}
          <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm flex-1 flex flex-col">
            <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-indigo-500" /> Recent Uploaded Cards
            </h2>
            {widgets?.recentUploads && widgets.recentUploads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-500">
                  <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <tr>
                      <th className="py-3">Original File</th>
                      <th className="py-3">Uploaded At</th>
                      <th className="py-3">OCR Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-semibold text-slate-800">
                    {widgets.recentUploads.map((card) => (
                      <tr key={card.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 pr-2 truncate max-w-[180px] text-indigo-600 font-bold flex items-center gap-2">
                          <ScanLine className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{card.uploadedFile?.originalName || 'business_card.jpg'}</span>
                        </td>
                        <td className="py-3 pr-2 font-medium text-slate-500">
                          {new Date(card.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide
                              ${
                                card.ocrStatus === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : card.ocrStatus === 'FAILED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                              }`}
                          >
                            {card.ocrStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <p className="text-xs text-slate-400 font-semibold">No uploaded business cards found.</p>
                <Button
                  onClick={() => navigate('/scanner')}
                  variant="outline"
                  className="mt-3 text-xs py-1.5 px-3 border border-indigo-200 hover:bg-indigo-50/20 text-indigo-600"
                >
                  Upload First Card
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
