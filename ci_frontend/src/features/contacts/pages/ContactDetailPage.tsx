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
} from 'lucide-react';

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'timeline'>('details');
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
      const status = contact.linkedInProfile?.enrichmentStatus;
      if (status === 'PENDING' || status === 'IN_PROGRESS') {
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

  const enrichmentStatus = contact.linkedInProfile?.enrichmentStatus || 'PENDING';
  const aiProfile = contact.linkedInProfile?.profileData;

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
          <Button
            onClick={handleTriggerEnrichment}
            isLoading={enrichMutation.isPending || isEnrichmentActive}
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
              {enrichmentStatus === 'COMPLETED' && aiProfile && (
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-slate-500">Retrieval Confidence</span>
                    <span className={aiProfile.confidenceScore >= 0.8 ? 'text-emerald-600' : 'text-amber-600'}>
                      {(aiProfile.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500
                        ${aiProfile.confidenceScore >= 0.8 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${(aiProfile.confidenceScore * 100)}%` }}
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
          <div className="border-b border-slate-200 flex gap-4 shrink-0">
            {(['details', 'notes', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 text-xs font-bold uppercase tracking-wider border-b-2 outline-none transition-all
                  ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
              >
                {tab === 'details' ? 'Profile details' : tab === 'notes' ? 'Meeting Notes' : 'Timeline events'}
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

                {/* AI Professional Summary */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">AI Professional Summary</h3>
                  <div className="text-xs text-slate-600 leading-relaxed font-semibold">
                    {contact.aiSummary?.summaryText ? (
                      <p>{contact.aiSummary.summaryText}</p>
                    ) : (
                      <p className="text-slate-400 italic">No summary description generated yet. Click "Refresh Enrichment".</p>
                    )}
                  </div>
                </div>

                {/* Skills tags cloud */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2.5">Skills</h3>
                  {contact.skills && contact.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {contact.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No skills cataloged.</p>
                  )}
                </div>

                {/* Experience History (Enrichment payload data) */}
                {enrichmentStatus === 'COMPLETED' && aiProfile?.experience && aiProfile.experience.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Work Experience</h3>
                    <div className="space-y-3">
                      {aiProfile.experience.map((exp: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-0.5">
                          <h4 className="text-xs font-bold text-slate-800">{exp.title}</h4>
                          <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold mt-0.5">
                            <span>{exp.company}</span>
                            <span>{exp.period}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education History (Enrichment payload data) */}
                {enrichmentStatus === 'COMPLETED' && aiProfile?.education && aiProfile.education.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Education</h3>
                    <div className="space-y-3">
                      {aiProfile.education.map((edu: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-0.5">
                          <h4 className="text-xs font-bold text-slate-800">{edu.degree}</h4>
                          <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold mt-0.5">
                            <span>{edu.school}</span>
                            <span>{edu.year}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social links */}
                {enrichmentStatus === 'COMPLETED' && aiProfile?.publicProfiles && aiProfile.publicProfiles.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2.5">Public Social Profiles</h3>
                    <div className="flex flex-wrap gap-2">
                      {aiProfile.publicProfiles.map((p: any, idx: number) => (
                        <a
                          key={idx}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          {p.platform}
                        </a>
                      ))}
                    </div>
                  </div>
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
