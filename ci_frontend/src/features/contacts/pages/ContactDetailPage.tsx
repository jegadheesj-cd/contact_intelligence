import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useContact,
  useAddNote,
  useDeleteNote,
  useDuplicates,
  useTimeline,
  useTriggerEnrichment,
} from '../../../hooks/useContacts';
import { useToastStore } from '../../../store/useToastStore';
import { Loader } from '../../../components/Loader';
import { Button } from '../../../components/Button';
import { ConfirmModal } from '../../../components/ConfirmModal';
import {
  ArrowLeft,
  Briefcase,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  AlertTriangle,
  Cpu,
  Bookmark,
  Activity,
  Plus,
  Trash2,
  AlertCircle,
  ExternalLink,
  Award,
  Info,
  Loader2,
  Search,
  Users,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  const [activeTab, setActiveTab] = useState<'details' | 'intelligence' | 'notes' | 'timeline'>('details');
  const [newNote, setNewNote] = useState('');
  
  // Note delete confirmation state
  const [noteToDelete, setNoteToDelete] = useState<{ contactId: string; noteId: string } | null>(null);

  // Poll details automatically when enrichment status is active
  const [isEnrichmentActive, setIsEnrichmentActive] = useState(false);

  // Queries & Mutations hooks
  const { data: contact, isLoading, isError } = useContact(id || '', isEnrichmentActive);
  const { data: duplicates } = useDuplicates(id || '');
  const { data: timeline } = useTimeline(id || '');

  const addNoteMutation = useAddNote();
  const deleteNoteMutation = useDeleteNote();
  const enrichMutation = useTriggerEnrichment();

  // Monitor enrichment status to toggle polling loop
  useEffect(() => {
    if (contact) {
      const status = contact.professionalProfile?.enrichmentStatus;
      if (status && ['PENDING', 'QUEUED', 'PROCESSING', 'FETCHING_PROFILE', 'VERIFYING', 'GENERATING_SUMMARY'].includes(status)) {
        setIsEnrichmentActive(true);
      } else {
        setIsEnrichmentActive(false);
      }
    }
  }, [contact]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newNote.trim()) return;
    try {
      await addNoteMutation.mutateAsync({ contactId: id, content: newNote.trim() });
      addToast('Note appended successfully.', 'success');
      setNewNote('');
    } catch (err: any) {
      addToast(err.message || 'Failed to add note.', 'error');
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNoteMutation.mutateAsync({
        contactId: noteToDelete.contactId,
        noteId: noteToDelete.noteId,
      });
      addToast('Note deleted successfully.', 'success');
      setNoteToDelete(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to delete note.', 'error');
    }
  };

  const handleTriggerEnrichment = async () => {
    if (!id) return;
    try {
      addToast('LinkedIn & AI profile enrichment pipeline triggered.', 'info');
      await enrichMutation.mutateAsync(id);
      setIsEnrichmentActive(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to trigger enrichment.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader message="Loading profile file..." size="lg" />
      </div>
    );
  }

  if (isError || !contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[400px]">
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-rose-500" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-2">Profile not found</h2>
        <p className="text-sm text-slate-500 mb-6">
          The requested contact record does not exist or has been deleted.
        </p>
        <Button onClick={() => navigate('/contacts')} variant="outline" className="flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>
      </div>
    );
  }

  const score = contact.decisionMakerScore;
  
  // Scoring explanations and tiers (Never calculated, derived purely from backend scores)
  let scoreTier = 'General Contact';
  let scoreExplanation = 'Standard contact with basic organizational influence.';
  let scoreFactors = ['Designation role represents supportive individual contributor activities.'];
  let scoreGaugeColor = 'stroke-slate-300';
  let scoreBg = 'bg-slate-50 text-slate-700 border-slate-100';

  if (score >= 95) {
    scoreTier = 'Executive Decision Maker';
    scoreExplanation = 'Direct organizational signature authority. Represents company executives, founders, and presidents.';
    scoreFactors = ['C-Suite Executive designation (CEO, CTO, CFO, Founder)', 'Direct signing power for platform vendor alignments'];
    scoreGaugeColor = 'stroke-emerald-500';
    scoreBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (score >= 80) {
    scoreTier = 'Management Leader';
    scoreExplanation = 'High-level department influencer. Direct budget and strategy allocations authority.';
    scoreFactors = ['High Management designation (VP, Director, Head)', 'Strategic project alignment control'];
    scoreGaugeColor = 'stroke-indigo-500';
    scoreBg = 'bg-indigo-50 text-indigo-700 border-indigo-100';
  } else if (score >= 60) {
    scoreTier = 'Manager / Lead';
    scoreExplanation = 'Team leader or project supervisor. Influences department alignments and team practices.';
    scoreFactors = ['Lead / Project Manager designation', 'Direct supervision of execution staff'];
    scoreGaugeColor = 'stroke-sky-500';
    scoreBg = 'bg-sky-50 text-sky-700 border-sky-100';
  } else if (score >= 40) {
    scoreTier = 'Senior Specialist';
    scoreExplanation = 'Senior individual contributor or advisory consultant with high professional experience.';
    scoreFactors = ['Senior / Consultant designation', 'Technical advisory influence'];
    scoreGaugeColor = 'stroke-amber-500';
    scoreBg = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (score >= 20) {
    scoreTier = 'Individual Contributor';
    scoreExplanation = 'Operational execution staff (engineer, programmer, developer, analyst).';
    scoreFactors = ['Professional contributor designation', 'Engineering / Analyst execution focus'];
    scoreGaugeColor = 'stroke-slate-400';
    scoreBg = 'bg-slate-50 text-slate-600 border-slate-200';
  }

  const initials = contact.name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const enrichmentStatus = contact.professionalProfile?.enrichmentStatus || 'PENDING';
  const rawProfile = contact.professionalProfile?.mergedProfile as any;
  const flatProfile: any = {};
  if (rawProfile) {
    for (const [key, val] of Object.entries(rawProfile)) {
      if (val && typeof val === 'object' && 'value' in (val as any)) {
        flatProfile[key] = (val as any).value;
      } else {
        flatProfile[key] = val;
      }
    }
  }
  const aiProfile = rawProfile ? flatProfile : null;
  const verificationStatus = contact.professionalProfile?.verificationStatus;
  const verificationConfidence = contact.professionalProfile?.verificationConfidence;

  let aiParsedSummary: any = null;
  try {
    if (contact.aiSummary?.summaryText) {
      aiParsedSummary = JSON.parse(contact.aiSummary.summaryText);
    }
  } catch (e) {
    aiParsedSummary = { executiveSummary: contact.aiSummary?.summaryText };
  }

  const isPipelineActive = ['QUEUED', 'PROCESSING', 'FETCHING_PROFILE', 'VERIFYING', 'GENERATING_SUMMARY'].includes(enrichmentStatus);

  const renderBadge = (fieldName: string) => {
    if (!rawProfile || !rawProfile[fieldName]) return null;
    const fieldObj = rawProfile[fieldName];
    if (!fieldObj || !fieldObj.source || fieldObj.source === 'None') return null;

    return (
      <span 
        className={`inline-flex items-center gap-1.5 ml-2.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide border shadow-sm
          ${fieldObj.verification === 'Verified' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
            : 'bg-slate-50 text-slate-500 border-slate-200'}`}
        title={`Source: ${fieldObj.source} | Confidence: ${fieldObj.confidence}% | Verification: ${fieldObj.verification}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${fieldObj.verification === 'Verified' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
        {fieldObj.source} ({fieldObj.confidence}%)
      </span>
    );
  };
  const renderSearchProcess = () => {
    const searchProcess = contact.professionalProfile?.mergedProfile?.searchProcess?.value || 
                          contact.professionalProfile?.sourceAttribution?.searchProcess?.value;
    if (!searchProcess || Object.keys(searchProcess).length === 0) return null;

    return (
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Search Engine Query Log</h4>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          Timeline of multi-source queries executed by the Professional Intelligence Engine.
        </p>
        <div className="relative border-l border-slate-200 ml-3 pl-6 space-y-4 py-2">
          {Object.entries(searchProcess).map(([provider, results]: any, idx) => {
            const hasResult = results && !results.includes('0 Results') && !results.includes('Disabled');
            return (
              <div key={idx} className="relative">
                <span className={`absolute -left-[31px] top-0.5 rounded-full p-1 border shadow-sm
                  ${hasResult ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  {hasResult ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                </span>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800">{provider}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                    ${hasResult ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                  >
                    {results}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDiscoveredCandidates = () => {
    const responses = contact.professionalProfile?.providerResponses;
    if (!responses || !Array.isArray(responses) || responses.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Discovered Candidates ({responses.length})</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {responses.map((resp: any, idx: number) => {
            const cand = resp.data;
            const isBest = idx === 0 && resp.confidence >= 70;
            const linkedin = cand.publicProfiles?.find((p: any) => p.platform === 'LinkedIn')?.url;
            const github = cand.publicProfiles?.find((p: any) => p.platform === 'GitHub')?.url;
            const portfolio = cand.publicProfiles?.find((p: any) => p.platform === 'Portfolio' || p.platform === 'Social' || p.platform === 'Company Website')?.url;

            return (
              <div key={idx} className={`p-5 rounded-2xl border transition-all duration-300 shadow-sm flex flex-col justify-between
                ${isBest 
                  ? 'bg-gradient-to-br from-indigo-50/50 via-white to-white border-indigo-200 shadow-indigo-100/40 ring-1 ring-indigo-50' 
                  : 'bg-white border-slate-100 hover:border-slate-200'}`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border
                      ${cand.verificationStatus === 'Verified' || resp.confidence >= 70
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                    >
                      {cand.verificationStatus || 'Unverified'}
                    </span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full border
                      ${resp.confidence >= 70 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}
                    >
                      {resp.confidence}% Confidence
                    </span>
                  </div>
                  
                  <h5 className="text-sm font-black text-slate-800 flex items-center">
                    {cand.fullName || contact.name}
                    {isBest && (
                      <span className="ml-1.5 inline-flex px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-wide">
                        Best Match
                      </span>
                    )}
                  </h5>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    {cand.designation || cand.headline || 'Professional Profile'}
                  </p>
                  {cand.company && (
                    <p className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase tracking-wide">
                      Company: {cand.company}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100/70 flex items-center gap-3">
                  {linkedin && (
                    <a href={linkedin} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline">
                      LinkedIn
                    </a>
                  )}
                  {github && (
                    <a href={github} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-slate-700 hover:underline">
                      GitHub
                    </a>
                  )}
                  {portfolio && (
                    <a href={portfolio} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-600 hover:underline">
                      Portfolio/Web
                    </a>
                  )}
                  <span className="ml-auto text-[9px] font-medium text-slate-400">
                    via {resp.sourceName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down">
      {/* Back link */}
      <div>
        <button
          onClick={() => navigate('/contacts')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Contacts Directory
        </button>
      </div>

      {/* Profile Header */}
      <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-indigo-50 border-2 border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl tracking-wide shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl font-extrabold text-slate-900 leading-tight truncate">{contact.name}</h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              {contact.designation || 'No title'} {contact.company ? `@ ${contact.company}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold border ${scoreBg}`}>
              Decision Score: {score}
            </span>
            {isPipelineActive && (
              <span className="inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold border bg-blue-50 text-blue-700 border-blue-200 animate-pulse uppercase">
                {enrichmentStatus.replace('_', ' ')}...
              </span>
            )}
            <Button
              onClick={handleTriggerEnrichment}
              isLoading={enrichMutation.isPending || isPipelineActive}
              className="flex items-center gap-1.5 py-1.5 px-3.5 text-xs shadow-sm shadow-indigo-600/10 font-bold"
            >
            <Cpu className="h-4 w-4" /> Refresh Enrichment
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Biometrics, Scoring factors, and Enriched summary */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Potential Duplicates */}
          {duplicates && duplicates.length > 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 text-rose-800 animate-pulse">
              <h2 className="text-xs font-extrabold tracking-wider uppercase mb-2.5 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" /> Duplicates Alert
              </h2>
              <p className="text-xs text-rose-700 leading-relaxed mb-3 font-semibold">
                Similar profiles detected in database:
              </p>
              <div className="space-y-2">
                {duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    onClick={() => navigate(`/contacts/${dup.id}`)}
                    className="p-2 bg-white/60 hover:bg-white border border-rose-100/40 rounded-lg flex justify-between items-center cursor-pointer transition-all text-xs font-bold"
                  >
                    <span className="truncate max-w-[120px] text-rose-900">{dup.name}</span>
                    <span className="text-[10px] bg-rose-100 px-1.5 py-0.5 rounded text-rose-700">
                      Match: {(dup.score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Maker Score Explanations */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-indigo-500" /> Decision Insights
            </h2>
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
              {/* Circular Gauge */}
              <div className="relative h-24 w-24 mb-3">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="stroke-slate-100"
                    strokeWidth="3.5"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`${scoreGaugeColor} transition-all duration-500`}
                    strokeDasharray={`${score}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold text-slate-800 leading-none">{score}</span>
                  <span className="text-[9px] text-slate-400 font-bold mt-0.5">SCORE</span>
                </div>
              </div>
              <h3 className="text-xs font-bold text-slate-800 capitalize leading-none">{scoreTier}</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">Classification Tier</p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tier Definition</p>
                <p className="text-xs font-semibold text-slate-600 mt-1 leading-relaxed">
                  {scoreExplanation}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scoring Factors</p>
                <ul className="mt-1 space-y-1.5">
                  {scoreFactors.map((factor, idx) => (
                    <li key={idx} className="text-xs font-semibold text-slate-500 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* AI Enrichment Status */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-500" /> AI Grounding Status
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Pipeline State:</span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase
                    ${
                      enrichmentStatus === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : enrichmentStatus === 'FAILED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                    }`}
                >
                  {enrichmentStatus}
                </span>
              </div>

              {/* Enrichment loader */}
              {isEnrichmentActive && (
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                  <div className="h-4 w-4 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500 leading-tight">
                    Polling Gemini AI grounding...
                  </span>
                </div>
              )}

              {enrichmentStatus === 'FAILED' && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-semibold">
                  Enrichment queue failed. Click "Refresh Enrichment" to try again.
                </div>
              )}

              {/* Confidence progress bar */}
              {enrichmentStatus === 'COMPLETED' && verificationConfidence !== undefined && (
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-slate-500">Retrieval Confidence</span>
                    <span className={verificationConfidence >= 80 ? 'text-emerald-600' : 'text-amber-600'}>
                      {verificationConfidence.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500
                        ${verificationConfidence >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${verificationConfidence}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Tab panels */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Tabs bar */}
          <div className="border-b border-slate-200 flex gap-4 shrink-0 overflow-x-auto">
            {(['details', 'intelligence', 'notes', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 text-xs font-bold uppercase tracking-wider border-b-2 outline-none transition-all whitespace-nowrap
                  ${
                    activeTab === tab
                      ? tab === 'intelligence' ? 'border-purple-600 text-purple-700' : 'border-indigo-600 text-indigo-600'
                      : tab === 'intelligence' ? 'border-transparent text-purple-400 hover:text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
              >
                {tab === 'details' ? 'Profile details' : tab === 'notes' ? 'Meeting Notes' : tab === 'timeline' ? 'Timeline events' : '✨ AI Intelligence'}
              </button>
            ))}
          </div>

          <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-xs flex-1 flex flex-col min-h-[400px]">
            {/* DETAILS TAB */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Basic info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Email</p>
                      <p className="text-xs font-semibold text-slate-800 mt-1">{contact.email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Phone</p>
                      <p className="text-xs font-semibold text-slate-800 mt-1">{contact.phone || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Website</p>
                      {contact.website ? (
                        <a
                          href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-indigo-600 hover:underline mt-1 block"
                        >
                          {contact.website}
                        </a>
                      ) : (
                        <p className="text-xs font-semibold text-slate-800 mt-1">N/A</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Location</p>
                      <p className="text-xs font-semibold text-slate-800 mt-1">{contact.address || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Import Date</p>
                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Bookmark className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Import Source</p>
                      <p className="text-xs font-semibold text-slate-800 mt-1 uppercase">{contact.source}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI INTELLIGENCE TAB */}
            {activeTab === 'intelligence' && (
              <div className="space-y-8 animate-fade-in text-slate-800">
                {!aiProfile && !aiParsedSummary && !isPipelineActive ? (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
                      <div className="p-4 bg-purple-50 rounded-full mb-4">
                        <Cpu className="h-8 w-8 text-purple-500 animate-pulse" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">No Verified Profile Found</h3>
                      <p className="text-xs text-slate-500 mt-2 max-w-sm">
                        We could not find a highly confident match for this contact. Trigger the pipeline again or verify their details.
                      </p>
                    </div>
                    {renderSearchProcess()}
                  </div>
                ) : isPipelineActive ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
                    <div className="p-4 bg-blue-50 rounded-full mb-4">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">{enrichmentStatus.replace('_', ' ')}</h3>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm">
                      The AI Intelligence pipeline is currently running this stage.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* VERIFIED PROFILE HEADER & CONFIDENCE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className={`col-span-2 p-6 rounded-2xl border bg-gradient-to-br transition-all duration-300 shadow-sm
                        ${verificationStatus && verificationStatus.includes('Failed') 
                          ? 'from-amber-50/50 via-white to-white border-amber-100/70 shadow-amber-500/2' 
                          : 'from-emerald-50/50 via-white to-white border-emerald-100/70 shadow-emerald-500/2'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border mb-3
                              ${verificationStatus && verificationStatus.includes('Failed') 
                                ? 'bg-amber-100/65 text-amber-700 border-amber-200' 
                                : 'bg-emerald-100/65 text-emerald-700 border-emerald-200'}`}>
                              {verificationStatus || 'Verified'}
                            </span>
                            <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center flex-wrap">
                              {aiProfile?.fullName || contact.name}
                              {renderBadge('fullName')}
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center flex-wrap">
                              {aiProfile?.headline || contact.designation || 'Professional Profile'}
                              {renderBadge('headline')}
                            </p>
                            
                            {contact.professionalProfile?.providersUsed && contact.professionalProfile.providersUsed.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sources Used:</span>
                                {contact.professionalProfile.providersUsed.map((source: string) => (
                                  <span key={source} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600">
                                    {source}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {verificationConfidence !== undefined && (
                            <div className="flex flex-col items-center shrink-0">
                              <div className="relative h-16 w-16 flex items-center justify-center">
                                <svg className="absolute transform -rotate-90 w-16 h-16">
                                  <circle cx="32" cy="32" r="28" strokeWidth="4" stroke="#f1f5f9" fill="transparent" />
                                  <circle cx="32" cy="32" r="28" strokeWidth="4" 
                                    stroke={verificationStatus && verificationStatus.includes('Failed') ? '#f59e0b' : '#10b981'} 
                                    fill="transparent" 
                                    strokeDasharray={2 * Math.PI * 28}
                                    strokeDashoffset={2 * Math.PI * 28 * (1 - verificationConfidence / 100)} 
                                  />
                                </svg>
                                <span className="text-sm font-black text-slate-900">{verificationConfidence.toFixed(0)}%</span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Confidence</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* DECISION MAKER GAUGE */}
                      <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col justify-between">
                        <div>
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border bg-purple-50 text-purple-700 border-purple-100 mb-3">
                            Target Insight
                          </span>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Decision Maker Score</h4>
                          <p className="text-2xl font-black text-slate-950 mt-1">{contact.decisionMakerScore}/100</p>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 mt-2 leading-relaxed">
                          {aiParsedSummary?.decisionMakerExplanation || 'Score evaluated based on current professional tier.'}
                        </p>
                      </div>
                    </div>

                    {/* ABOUT / SUMMARY */}
                    {(aiProfile?.summary || aiProfile?.companyBio) && (
                      <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-2xl">
                        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2.5 flex items-center">About {renderBadge('summary') || renderBadge('companyBio')}</h4>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed">
                          {aiProfile?.summary || aiProfile?.companyBio}
                        </p>
                      </div>
                    )}

                    {/* EXECUTIVE SUMMARY & HIGHLIGHTS */}
                    {(aiParsedSummary?.executiveSummary || (aiParsedSummary?.careerHighlights && aiParsedSummary.careerHighlights.length > 0)) && (
                      <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-2xl space-y-4">
                        {aiParsedSummary?.executiveSummary && (
                          <div>
                            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2.5">AI Professional Summary</h4>
                            <p className="text-sm text-slate-700 font-medium leading-relaxed">
                              {aiParsedSummary.executiveSummary}
                            </p>
                          </div>
                        )}
                        {aiParsedSummary?.careerHighlights && aiParsedSummary.careerHighlights.length > 0 && (
                          <div>
                            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Key Career Highlights</h4>
                            <ul className="list-disc list-inside text-xs font-semibold text-slate-700 space-y-1.5 pl-1">
                              {aiParsedSummary.careerHighlights.map((hl: string, idx: number) => (
                                <li key={idx} className="leading-relaxed">{hl}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TWO COLUMN CONTENT LAYOUT */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
                      
                      {/* LEFT COLUMN: HISTORY & EDUCATION */}
                      <div className="space-y-6">
                        {/* Career Timeline */}
                        <div>
                          <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-indigo-500" /> Career Timeline {renderBadge('experience')}
                          </h3>
                          {aiProfile?.experience && aiProfile.experience.length > 0 ? (
                            <div className="relative border-l-2 border-slate-100 pl-5 ml-2.5 space-y-6">
                              {aiProfile.experience.map((exp: any, idx: number) => (
                                <div key={idx} className="relative flex flex-col gap-1">
                                  <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                                  <h4 className="text-sm font-bold text-slate-900 leading-tight">{exp.title}</h4>
                                  <div className="flex items-center text-xs text-slate-500 font-semibold">
                                    <span className="text-indigo-600">{exp.company}</span>
                                    <span className="mx-2">•</span>
                                    <span>{exp.period}</span>
                                  </div>
                                  {exp.description && (
                                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{exp.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No verified career history available.</p>
                          )}
                        </div>

                        {/* Education */}
                        <div className="border-t border-slate-50 pt-5">
                          <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Award className="h-4 w-4 text-purple-500" /> Education {renderBadge('education')}
                          </h3>
                          {aiProfile?.education && aiProfile.education.length > 0 ? (
                            <div className="relative border-l-2 border-slate-100 pl-5 ml-2.5 space-y-6">
                              {aiProfile.education.map((edu: any, idx: number) => (
                                <div key={idx} className="relative flex flex-col gap-1">
                                  <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full bg-purple-500 border-2 border-white shadow-sm" />
                                  <h4 className="text-sm font-bold text-slate-900 leading-tight">{edu.degree}</h4>
                                  <div className="flex items-center text-xs text-slate-500 font-semibold">
                                    <span className="text-purple-600">{edu.school}</span>
                                    {edu.year && (
                                      <>
                                        <span className="mx-2">•</span>
                                        <span>Graduation Year: {edu.year}</span>
                                      </>
                                    )}
                                  </div>
                                  {edu.fieldOfStudy && (
                                    <p className="text-xs text-slate-500 font-semibold">Field of Study: {edu.fieldOfStudy}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No verified education information.</p>
                          )}
                        </div>
                      </div>

                      {/* RIGHT COLUMN: SKILLS, PROJECTS & LINKS */}
                      <div className="space-y-6">
                        {/* Verified Skills */}
                        <div>
                          <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">Verified Skills {renderBadge('skills')}</h3>
                          {contact.skills && contact.skills.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {contact.skills.map((skill) => (
                                <span key={skill} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100/50 text-indigo-700 rounded-lg text-xs font-bold shadow-sm shadow-indigo-500/2">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No verified skills detected.</p>
                          )}
                        </div>

                        {/* Projects */}
                        {aiProfile?.projects && aiProfile.projects.length > 0 && (
                          <div className="border-t border-slate-50 pt-5">
                            <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">Featured Projects</h3>
                            <div className="space-y-3">
                              {aiProfile.projects.map((proj: any, idx: number) => (
                                <div key={idx} className="p-4 bg-white border border-slate-100 shadow-sm rounded-xl">
                                  <h4 className="text-xs font-black text-slate-900">{proj.name}</h4>
                                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{proj.description}</p>
                                  {proj.technologies && proj.technologies.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2.5">
                                      {proj.technologies.map((t: string) => (
                                        <span key={t} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[9px] font-bold">
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Public Links */}
                        <div className="border-t border-slate-50 pt-5">
                          <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">Professional Profiles</h3>
                          <div className="flex flex-wrap gap-2.5">
                            {aiProfile?.publicProfiles && [...aiProfile.publicProfiles]
                              .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
                              .map((p: any, idx: number) => {
                                const conf = p.confidence !== undefined ? p.confidence : 80;
                                
                                // Choose color class based on confidence
                                let badgeColor = 'text-rose-700 bg-rose-50 border-rose-100';
                                let dotColor = 'bg-rose-500';
                                if (conf >= 90) {
                                  badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                                  dotColor = 'bg-emerald-500';
                                } else if (conf >= 75) {
                                  badgeColor = 'text-blue-700 bg-blue-50 border-blue-100';
                                  dotColor = 'bg-blue-500';
                                } else if (conf >= 60) {
                                  badgeColor = 'text-amber-700 bg-amber-50 border-amber-100';
                                  dotColor = 'bg-amber-500';
                                }

                                // Tooltip text
                                const tooltipText = p.reasons && Array.isArray(p.reasons)
                                  ? `Confidence: ${conf}%\nMatched factors:\n${p.reasons.map((r: string) => `✓ ${r.split(':')[0]}`).join('\n')}`
                                  : `Confidence: ${conf}%`;

                                return (
                                  <a key={idx} href={p.url} target="_blank" rel="noopener noreferrer" title={tooltipText}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all shadow-sm group"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
                                    <span>{p.platform}</span>
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black border ${badgeColor}`}>
                                      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                                      {conf}%
                                    </span>
                                  </a>
                                );
                              })
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DYNAMIC ACCORDIONS GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                      {/* Languages */}
                      {aiProfile?.languages && aiProfile.languages.length > 0 && (
                        <div className="p-5 bg-slate-50/40 border border-slate-100 rounded-2xl">
                          <h4 className="text-xs font-black text-slate-900 mb-2">Languages</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {aiProfile.languages.map((l: string) => (
                              <span key={l} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md text-xs font-semibold">
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Certifications */}
                      {aiProfile?.certifications && aiProfile.certifications.length > 0 && (
                        <div className="p-5 bg-slate-50/40 border border-slate-100 rounded-2xl">
                          <h4 className="text-xs font-black text-slate-900 mb-2">Certifications</h4>
                          <ul className="list-disc pl-4 space-y-1 text-xs font-semibold text-slate-700">
                            {aiProfile.certifications.map((c: string, idx: number) => (
                              <li key={idx}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Achievements */}
                      {aiProfile?.achievements && aiProfile.achievements.length > 0 && (
                        <div className="p-5 bg-slate-50/40 border border-slate-100 rounded-2xl">
                          <h4 className="text-xs font-black text-slate-900 mb-2">Achievements</h4>
                          <ul className="list-disc pl-4 space-y-1 text-xs font-semibold text-slate-700">
                            {aiProfile.achievements.map((a: string, idx: number) => (
                              <li key={idx}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Interests */}
                      {aiProfile?.interests && aiProfile.interests.length > 0 && (
                        <div className="p-5 bg-slate-50/40 border border-slate-100 rounded-2xl">
                          <h4 className="text-xs font-black text-slate-900 mb-2">Interests</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {aiProfile.interests.map((i: string) => (
                              <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md text-xs font-semibold">
                                {i}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* GITHUB STATS BAR */}
                    {aiProfile?.githubStats && (
                      <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span>⚡</span> GitHub Profile
                        </h3>
                        <div className="grid grid-cols-3 gap-4 mb-5">
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
                            <p className="text-xl font-black text-slate-900">{aiProfile.githubStats.followers?.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Followers</p>
                          </div>
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
                            <p className="text-xl font-black text-slate-900">{aiProfile.githubStats.following?.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Following</p>
                          </div>
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
                            <p className="text-xl font-black text-slate-900">{aiProfile.githubStats.publicRepos?.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Public Repos</p>
                          </div>
                        </div>

                        {/* Primary Languages */}
                        {aiProfile?.primaryLanguages && aiProfile.primaryLanguages.length > 0 && (
                          <div className="mb-5">
                            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Primary Languages</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {aiProfile.primaryLanguages.map((lang: string) => (
                                <span key={lang} className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-xs font-bold">{lang}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Technologies */}
                        {aiProfile?.technologies && aiProfile.technologies.length > 0 && (
                          <div className="mb-5">
                            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Technologies & Topics</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {aiProfile.technologies.map((tech: string) => (
                                <span key={tech} className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">{tech}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Repositories */}
                        {aiProfile?.repositories && aiProfile.repositories.length > 0 && (
                          <div>
                            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Public Repositories</h4>
                            <div className="space-y-2">
                              {aiProfile.repositories.slice(0, 6).map((repo: any, idx: number) => (
                                <a key={idx} href={repo.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">{repo.name}</p>
                                    {repo.description && (
                                      <p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed line-clamp-2">{repo.description}</p>
                                    )}
                                    {repo.topics && repo.topics.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {repo.topics.slice(0, 4).map((t: string) => (
                                          <span key={t} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-500 rounded text-[9px] font-bold">{t}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {repo.language && (
                                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded text-[10px] font-bold">{repo.language}</span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-semibold">⭐ {repo.stars}</span>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* COMPANY WEBSITE BIO */}
                    {aiProfile?.companyRole && (
                      <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Globe className="h-4 w-4 text-orange-500" /> Company Website
                        </h3>
                        <div className="p-5 bg-orange-50/30 border border-orange-100/60 rounded-2xl flex gap-4">
                          {aiProfile.companyPhotoUrl && (
                            <img src={aiProfile.companyPhotoUrl} alt={contact.name} className="h-14 w-14 rounded-full object-cover shrink-0 border border-orange-100" />
                          )}
                          <div>
                            {aiProfile.companyRole && (
                              <p className="text-xs font-bold text-orange-700 mb-1">{aiProfile.companyRole}</p>
                            )}
                            {aiProfile.companyBio && (
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">{aiProfile.companyBio}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI INSIGHTS & SUGGESTIONS */}
                    <div className="border-t border-slate-100 pt-6 space-y-6">
                      <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider">AI Insights & Engagement Strategies</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Conversation Starters */}
                        {aiParsedSummary?.conversationStarters && aiParsedSummary.conversationStarters.length > 0 && (
                          <div className="p-5 bg-gradient-to-br from-indigo-50/30 to-white border border-indigo-100/60 rounded-2xl">
                            <h4 className="text-xs font-black text-indigo-950 mb-3 flex items-center gap-1.5">💬 Conversation Starters</h4>
                            <div className="space-y-2">
                              {aiParsedSummary.conversationStarters.map((starter: string, idx: number) => (
                                <div key={idx} className="p-3 bg-white border border-indigo-50/60 rounded-xl">
                                  <p className="text-xs font-semibold text-slate-700 leading-relaxed">"{starter}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Networking Suggestions & Strengths */}
                        <div className="space-y-4">
                          {aiParsedSummary?.networkingSuggestions && (
                            <div className="p-5 bg-gradient-to-br from-purple-50/30 to-white border border-purple-100/60 rounded-2xl">
                              <h4 className="text-xs font-black text-purple-950 mb-2.5">🤝 Networking Strategy</h4>
                              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                {aiParsedSummary.networkingSuggestions}
                              </p>
                            </div>
                          )}

                          {aiParsedSummary?.professionalStrengths && aiParsedSummary.professionalStrengths.length > 0 && (
                            <div className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl">
                              <h4 className="text-xs font-black text-slate-900 mb-2.5">⭐ Professional Strengths</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {aiParsedSummary.professionalStrengths.map((str: string, idx: number) => (
                                  <span key={idx} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold shadow-sm">
                                    {str}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Meeting Preparation Brief */}
                    {aiParsedSummary?.meetingPreparation && (
                      <div className="mt-6 p-5 bg-gradient-to-br from-emerald-50/30 to-white border border-emerald-100/60 rounded-2xl">
                        <h4 className="text-xs font-black text-emerald-950 mb-2.5">📅 Meeting Preparation Brief</h4>
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                          {aiParsedSummary.meetingPreparation}
                        </p>
                      </div>
                    )}

                    {/* Field-Level Verification Attribution Table */}
                    {contact.professionalProfile?.sourceAttribution && Object.keys(contact.professionalProfile.sourceAttribution).length > 0 && (
                      <div className="mt-6 space-y-4">
                        <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider">Field-Level Verification Attribution</h3>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-sm">
                          <table className="min-w-full text-left text-xs text-slate-500">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                              <tr>
                                <th className="py-3 px-4">Field</th>
                                <th className="py-3 px-4">Source</th>
                                <th className="py-3 px-4">Confidence</th>
                                <th className="py-3 px-4">Verification</th>
                                <th className="py-3 px-4">Timestamp</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-850">
                              {Object.entries(contact.professionalProfile.sourceAttribution).map(([field, attr]: [string, any]) => (
                                <tr key={field} className="hover:bg-slate-50/40">
                                  <td className="py-3 px-4 text-indigo-600 font-bold capitalize">
                                    {field.replace(/([A-Z])/g, ' $1')}
                                  </td>
                                  <td className="py-3 px-4 font-medium text-slate-500">
                                    {attr.source}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold
                                      ${attr.confidence >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                        (attr.confidence >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100')}`}>
                                      {attr.confidence}%
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold
                                      ${attr.verification === 'Verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                      {attr.verification}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-medium text-slate-400">
                                    {new Date(attr.timestamp).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Discovered Candidates */}
                    <div className="border-t border-slate-100 pt-6">
                      {renderDiscoveredCandidates()}
                    </div>

                    {/* Search Process Timeline */}
                    <div className="border-t border-slate-100 pt-6">
                      {renderSearchProcess()}
                    </div>
                  </div>
                </>
                )}
              </div>
            )}

            {/* NOTES TAB */}
            {activeTab === 'notes' && (
              <div className="flex-1 flex flex-col gap-6">
                <form onSubmit={handleAddNote} className="flex gap-2.5 items-end border-b border-slate-100 pb-5">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">
                      Append Note
                    </label>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Write feedback, meeting summaries, or details..."
                      rows={2}
                      className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg p-2.5 text-xs outline-none resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    isLoading={addNoteMutation.isPending}
                    className="flex items-center gap-1 h-9 px-4 font-bold text-xs"
                  >
                    <Plus className="h-4 w-4" /> Save
                  </Button>
                </form>

                {contact.notes && contact.notes.length > 0 ? (
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                    {contact.notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-start justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                            {note.content}
                          </p>
                          <span className="text-[9px] text-slate-400 mt-2 block font-medium">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => setNoteToDelete({ contactId: contact.id, noteId: note.id })}
                          className="p-1 hover:bg-slate-100 hover:text-rose-600 text-slate-400 rounded transition-colors outline-none"
                          title="Delete Note"
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-6 text-center">No timeline notes added yet.</p>
                )}
              </div>
            )}

            {/* TIMELINE TAB */}
            {activeTab === 'timeline' && (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                {timeline && timeline.length > 0 ? (
                  <div className="relative border-l-2 border-slate-100 pl-4 ml-2.5 space-y-5">
                    {timeline.map((log) => {
                      // Custom labels & descriptions for audit log actions
                      let logTitle = log.action.toLowerCase().replace(/_/g, ' ');
                      let logDesc = '';

                      if (log.action === 'OCR_PROCESSING_COMPLETED') {
                        logTitle = 'Ingested via OCR Card Scanner';
                        logDesc = 'Parsed name and title details from physical business card image upload.';
                      } else if (log.action === 'CONTACT_CREATED_FROM_OCR') {
                        logTitle = 'Contact Card created from OCR';
                        logDesc = 'Auto-created database contact record following OCR extraction parsing.';
                      } else if (log.action === 'FACE_RECOGNITION_MATCHED') {
                        logTitle = 'Identified via Face Match';
                        logDesc = `Verified identity with similarity score of ${((log.details?.similarityScore || 0) * 100).toFixed(0)}%.`;
                      } else if (log.action === 'PROFILE_ENRICHED') {
                        logTitle = 'AI Profile Enriched';
                        logDesc = 'Triggered Gemini search grounding models to parse education and skills lists.';
                      } else if (log.action === 'AI_SUMMARY_GENERATED') {
                        logTitle = 'AI Summary Compiled';
                        logDesc = 'Compiled contextual summary insight paragraph details.';
                      }

                      return (
                        <div key={log.id} className="relative flex flex-col gap-1">
                          <span className="absolute -left-7 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-500 shadow-sm flex items-center justify-center">
                            <Activity className="h-1.5 w-1.5 text-white" />
                          </span>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-extrabold text-slate-800 capitalize leading-none">
                              {logTitle}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {logDesc && (
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-semibold">
                              {logDesc}
                            </p>
                          )}
                          {log.details && !logDesc && (
                            <pre className="text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded border border-slate-100/50 mt-1 max-h-24 overflow-y-auto font-mono">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-6 text-center">No timeline events detected.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Delete Note Modal */}
      <ConfirmModal
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleDeleteNote}
        title="Delete Note"
        message="Are you sure you want to delete this meeting note? This action is permanent."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteNoteMutation.isPending}
      />
    </div>
  );
};
