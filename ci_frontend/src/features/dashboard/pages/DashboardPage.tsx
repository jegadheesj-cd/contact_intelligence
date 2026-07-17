import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardWidgets, useDashboardAnalytics } from '../../../hooks/useDashboard';
import { Loader } from '../../../components/Loader';
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
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader message="Loading dashboard aggregates..." size="lg" />
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
    <div className="flex flex-col gap-6 animate-slide-down">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Workspace Overview</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            Contact Intelligence Engine
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-1.5 py-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Data
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contacts */}
        <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Total Contacts
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
              {widgets?.totalContacts || 0}
            </h3>
          </div>
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* OCR Success Rate */}
        <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              OCR Success Rate
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
              {ocrRate.toFixed(0)}%
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600">
            <Zap className="h-6 w-6" />
          </div>
        </div>

        {/* Face Recognition similarity */}
        <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Face Similarity
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
              {matchAccuracy > 0 ? `${(matchAccuracy * 100).toFixed(0)}%` : '0.00'}
            </h3>
          </div>
          <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg text-sky-600">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        {/* Average Processing time */}
        <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Avg OCR Speed
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
              {avgOcrTime > 0 ? `${(avgOcrTime / 1000).toFixed(1)}s` : '0.0s'}
            </h3>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-xs">
        <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-500" /> Quick Entry Portals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/scanner')}
            className="flex items-center gap-4 p-4 border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20 rounded-xl text-left transition-all duration-200"
          >
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Scan Card</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Capture OCR details</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/qr')}
            className="flex items-center gap-4 p-4 border border-slate-100 hover:border-sky-100 hover:bg-sky-50/20 rounded-xl text-left transition-all duration-200"
          >
            <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-lg text-sky-600">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Scan QR Code</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Parse vCard MeCard links</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/nfc')}
            className="flex items-center gap-4 p-4 border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/20 rounded-xl text-left transition-all duration-200"
          >
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600">
              <Nfc className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Read NFC Tag</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Import NDEF card data</p>
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
            <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
              <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-indigo-500" /> Queue Analytics
              </h2>
              <div className="space-y-3">
                {Object.entries(analytics.queueStatuses).map(([queueName, status]) => (
                  <div key={queueName} className="flex flex-col gap-1 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <span className="text-xs font-bold text-slate-800 capitalize leading-none">
                      {queueName.replace('Queue', '').replace(/([A-Z])/g, ' $1')}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        Wait: {status.waiting}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                        Active: {status.active}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                        Done: {status.completed}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                        Fail: {status.failed}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Companies */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" /> Top Companies
            </h2>
            {widgets?.commonCompanies && widgets.commonCompanies.length > 0 ? (
              <div className="space-y-2">
                {widgets.commonCompanies.map((c) => (
                  <div key={c.company} className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{c.company}</span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {c.count} {c.count === 1 ? 'contact' : 'contacts'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No company details aggregated yet.</p>
            )}
          </div>

          {/* Top Industries */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4">
              Top Industries
            </h2>
            {widgets?.commonIndustries && widgets.commonIndustries.length > 0 ? (
              <div className="space-y-2">
                {widgets.commonIndustries.map((ind) => (
                  <div key={ind.industry} className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{ind.industry}</span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {ind.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No industry details aggregated yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Recent Uploads & Enriched Profiles */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Recent Uploads Table */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex-1 flex flex-col">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-indigo-500" /> Recent Uploaded Cards
            </h2>
            {widgets?.recentUploads && widgets.recentUploads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-500">
                  <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-50">
                    <tr>
                      <th className="py-2.5">Original File</th>
                      <th className="py-2.5">Uploaded At</th>
                      <th className="py-2.5">OCR Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-semibold text-slate-800">
                    {widgets.recentUploads.map((card) => (
                      <tr key={card.id} className="hover:bg-slate-50/40">
                        <td className="py-2.5 pr-2 truncate max-w-[140px] text-indigo-600">
                          {card.uploadedFile?.originalName || 'business_card.jpg'}
                        </td>
                        <td className="py-2.5 pr-2 font-medium text-slate-500">
                          {new Date(card.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase
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

          {/* Top Skills Cloud */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4">
              Top Skills
            </h2>
            {widgets?.commonSkills && widgets.commonSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {widgets.commonSkills.map((sk) => (
                  <span
                    key={sk.skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold"
                  >
                    {sk.skill}
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1 rounded-full">
                      {sk.count}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No skills aggregated yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
