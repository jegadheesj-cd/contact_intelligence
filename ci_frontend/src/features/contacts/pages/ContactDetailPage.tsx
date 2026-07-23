import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useContact,
  useUpdateContact,
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
  AlertTriangle,
  Cpu,
  Activity,
  Plus,
  Trash2,
  AlertCircle,
  ExternalLink,
  Award,
  Loader2,
  Search,
  Users,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BookOpen,
  FolderGit2,
} from 'lucide-react';

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // Tab State: 'overview' | 'career' | 'ai' | 'discovery' | 'activity'
  const [activeTab, setActiveTab] = useState<'overview' | 'career' | 'ai' | 'discovery' | 'activity'>('overview');
  const [newNote, setNewNote] = useState('');
  
  // Note delete confirmation state
  const [noteToDelete, setNoteToDelete] = useState<{ contactId: string; noteId: string } | null>(null);

  // Poll details automatically when enrichment status is active
  const [isEnrichmentActive, setIsEnrichmentActive] = useState(false);

  // Collapsible panels state for Career tab
  const [collapsibles, setCollapsibles] = useState({
    certifications: false,
    achievements: false,
    languages: false,
    interests: false,
  });

  // Selected candidate profile detail drawer state
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  // Inline editing state for contact detail fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Queries & Mutations hooks
  const { data: contact, isLoading, isError } = useContact(id || '', isEnrichmentActive);
  const { data: duplicates } = useDuplicates(id || '');
  const { data: timeline } = useTimeline(id || '');

  const addNoteMutation = useAddNote();
  const deleteNoteMutation = useDeleteNote();
  const enrichMutation = useTriggerEnrichment();
  const updateContactMutation = useUpdateContact();

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader message="Loading profile workspace..." size="lg" />
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
        <p className="text-sm text-slate-500 mb-6 font-semibold">
          The requested contact record does not exist or has been deleted.
        </p>
        <Button onClick={() => navigate('/contacts')} variant="outline" className="flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Directory
        </Button>
      </div>
    );
  }

  const score = contact.decisionMakerScore;
  
  // Scoring explanations and tiers
  let scoreTier = 'General Contact';
  let scoreExplanation = 'Standard contact with basic organizational influence.';
  let scoreFactors = ['Designation role represents supportive individual contributor activities.'];
  let scoreGaugeColor = 'stroke-slate-300';
  let scoreBg = 'bg-slate-50 text-slate-700 border-slate-100';

  if (score >= 95) {
    scoreTier = 'Executive Decision Maker';
    scoreExplanation = 'Direct signature authority. Represents executives, founders, and presidents.';
    scoreFactors = ['C-Suite Executive designation (CEO, CTO, CFO, Founder)', 'Direct signing power for vendor alignments'];
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
    scoreBg = 'bg-slate-50 text-slate-650 border-slate-200';
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

  // Handle Note operations
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

  // Trigger manual enrichment pipeline
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

  // Perform inline edit updates
  const handleSaveField = async (fieldName: string) => {
    if (!id) return;
    const value = editValue.trim();
    
    // Name is required validation
    if (fieldName === 'name' && !value) {
      addToast('Name is required.', 'warning');
      return;
    }

    try {
      await updateContactMutation.mutateAsync({
        id,
        data: {
          [fieldName]: value || null,
        },
      });
      addToast(`Updated ${fieldName} successfully.`, 'success');
      setEditingField(null);
    } catch (err: any) {
      addToast(err.message || `Failed to update ${fieldName}.`, 'error');
    }
  };

  // Group discovered candidates by platform
  const getPlatformName = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('linkedin')) return 'LinkedIn';
    if (s.includes('github')) return 'GitHub';
    if (s.includes('website') || s.includes('cheerio') || s.includes('company')) return 'Company Website';
    if (s.includes('portfolio')) return 'Portfolio';
    if (s.includes('twitter') || s.includes('x.com')) return 'Twitter/X';
    if (s.includes('instagram')) return 'Instagram';
    if (s.includes('facebook')) return 'Facebook';
    return 'Other Platforms';
  };

  const groupCandidatesByPlatform = () => {
    const responses = contact.professionalProfile?.providerResponses;
    if (!responses || !Array.isArray(responses)) return {};
    
    const groups: Record<string, any[]> = {};
    responses.forEach((resp) => {
      // Only display discovered candidates that have at least 60% confidence
      if (resp.confidence < 60) return;

      const platform = getPlatformName(resp.sourceName);
      if (!groups[platform]) groups[platform] = [];
      groups[platform].push(resp);
    });
    return groups;
  };

  const groupedCandidates = groupCandidatesByPlatform();

  // Helper to render field inline edit row
  const renderInlineEditRow = (fieldName: string, label: string, icon: React.ReactNode, value: string | null | undefined) => {
    const isEditing = editingField === fieldName;
    const attribution = contact.professionalProfile?.sourceAttribution as any;
    const attr = attribution ? attribution[fieldName] : null;

    return (
      <div className="border-b border-slate-50 py-3 last:border-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            {icon} {label}
          </span>
          {attr && attr.confidence && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full
              ${attr.confidence >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
              title={`Source: ${attr.source} | Confidence: ${attr.confidence}%`}
            >
              {attr.confidence}%
            </span>
          )}
        </div>

        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveField(fieldName);
            }}
            className="flex items-center gap-2 mt-1"
          >
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-3 py-1 text-xs bg-slate-50 border border-indigo-500 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingField(null);
              }}
            />
            <button type="submit" className="p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 cursor-pointer">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setEditingField(null)} className="p-1 bg-slate-50 text-slate-500 rounded hover:bg-slate-100 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between min-h-[24px] mt-1 group">
            <span className={`text-xs font-semibold ${value ? 'text-slate-800' : 'text-slate-400 italic'}`}>
              {value || `No ${label.toLowerCase()} added`}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingField(fieldName);
                setEditValue(value || '');
              }}
              className="p-1 text-slate-400 hover:text-indigo-650 opacity-0 group-hover:opacity-100 transition-opacity rounded"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderBadge = (fieldName: string) => {
    if (!rawProfile || !rawProfile[fieldName]) return null;
    const fieldObj = rawProfile[fieldName];
    if (!fieldObj || !fieldObj.source || fieldObj.source === 'None') return null;

    return (
      <span 
        className={`inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded-full text-[8px] font-bold border tracking-wide select-none
          ${fieldObj.verification === 'Verified' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
            : 'bg-slate-50 text-slate-500 border-slate-200'}`}
        title={`Source: ${fieldObj.source} | Confidence: ${fieldObj.confidence}%`}
      >
        {fieldObj.source} ({fieldObj.confidence}%)
      </span>
    );
  };

  // Toggle collapsibles in Career section
  const toggleCollapsible = (key: keyof typeof collapsibles) => {
    setCollapsibles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down max-w-5xl mx-auto w-full px-2">
      {/* Back navigation */}
      <div>
        <button
          onClick={() => navigate('/contacts')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-550 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Contacts Directory
        </button>
      </div>

      {/* Header Profile summary card */}
      <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-indigo-50 border-2 border-indigo-100 text-indigo-650 flex items-center justify-center font-bold text-xl tracking-wide shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl font-extrabold text-slate-900 leading-tight truncate">{contact.name}</h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-semibold">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {contact.designation || 'No title'} {contact.company ? `@ ${contact.company}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold border select-none ${scoreBg}`}>
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

      {/* Duplicates Alert banner */}
      {duplicates && duplicates.length > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-rose-800 flex items-start gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-xs font-extrabold tracking-wider uppercase mb-1">Potential Duplicates Alert</h2>
            <p className="text-xs text-rose-700 leading-relaxed font-semibold">
              Similar profiles detected in database. Link/Merge files to ensure single source of truth:
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {duplicates.map((dup) => (
                <div
                  key={dup.id}
                  onClick={() => navigate(`/contacts/${dup.id}`)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-rose-100/40 rounded-lg flex items-center gap-2 cursor-pointer transition-all text-xs font-bold text-rose-900"
                >
                  <span>{dup.name}</span>
                  <span className="text-[10px] bg-rose-100 px-1.5 py-0.2 rounded text-rose-700">
                    {(dup.score * 100).toFixed(0)}% Match
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs navigation bar */}
      <div className="border-b border-slate-200 flex gap-4 shrink-0 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'career', label: 'Experience & Education' },
          { key: 'ai', label: '✨ AI Intelligence' },
          { key: 'discovery', label: 'Profile Discovery' },
          { key: 'activity', label: 'Activity & Notes' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`py-2 px-1 text-xs font-bold uppercase tracking-wider border-b-2 outline-none transition-all whitespace-nowrap
              ${
                activeTab === tab.key
                  ? tab.key === 'ai' ? 'border-purple-600 text-purple-700' : 'border-indigo-650 text-indigo-650'
                  : tab.key === 'ai' ? 'border-transparent text-purple-400 hover:text-purple-650' : 'border-transparent text-slate-450 hover:text-slate-650'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-h-[420px]">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-down">
            
            {/* Left Column: Basic editable info card */}
            <div className="lg:col-span-7 bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col gap-4">
              <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2">
                Basic Credentials
              </h2>
              <div className="flex flex-col gap-1.5">
                {renderInlineEditRow('name', 'Full Name', <Users className="h-3.5 w-3.5 text-slate-400" />, contact.name)}
                {renderInlineEditRow('company', 'Company', <Briefcase className="h-3.5 w-3.5 text-slate-400" />, contact.company)}
                {renderInlineEditRow('designation', 'Designation', <Briefcase className="h-3.5 w-3.5 text-slate-400" />, contact.designation)}
                {renderInlineEditRow('email', 'Email Address', <Mail className="h-3.5 w-3.5 text-slate-400" />, contact.email)}
                {renderInlineEditRow('phone', 'Phone Number', <Phone className="h-3.5 w-3.5 text-slate-400" />, contact.phone)}
                {renderInlineEditRow('website', 'Website URL', <Globe className="h-3.5 w-3.5 text-slate-400" />, contact.website)}
                {renderInlineEditRow('address', 'Location / Address', <MapPin className="h-3.5 w-3.5 text-slate-400" />, contact.address)}
              </div>
            </div>

            {/* Right Column: AI Merged Summary & Skills */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Grounded AI Bio */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-3">
                  AI Grounded Bio
                </h2>
                {aiProfile?.summary || aiProfile?.companyBio ? (
                  <p className="text-xs text-slate-650 leading-relaxed font-semibold border-l-2 border-indigo-250 pl-3.5 italic bg-slate-50/20 py-2 rounded-r-lg">
                    "{aiProfile.summary || aiProfile.companyBio}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No verified professional bio generated. Run profile enrichment to sync.</p>
                )}
              </div>

              {/* Verified Skills */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-3">
                  Verified Skills
                </h2>
                {contact.skills && contact.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.skills.map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold shadow-sm">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No verified technical skills detected.</p>
                )}
              </div>

              {/* Import Metadata */}
              <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl text-slate-500 space-y-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">Record Context</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Created On</span>
                    <span className="text-slate-700">{new Date(contact.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ingestion Source</span>
                    <span className="text-slate-700 uppercase">{contact.source}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAREER & EDUCATION TAB */}
        {activeTab === 'career' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-down">
            
            {/* Left Column: Timelines */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Career Timeline */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-4 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-500" /> Career History {renderBadge('experience')}
                </h2>
                
                {aiProfile?.experience && aiProfile.experience.length > 0 ? (
                  <div className="relative border-l-2 border-slate-100 pl-5 ml-2.5 space-y-6 py-2">
                    {aiProfile.experience.map((exp: any, idx: number) => (
                      <div key={idx} className="relative flex flex-col gap-1">
                        <span className="absolute -left-[26px] top-1.5 h-3.5 w-3.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                        <h3 className="text-xs font-bold text-slate-900 leading-tight">{exp.title}</h3>
                        <div className="flex items-center text-[10px] text-slate-555 font-bold">
                          <span className="text-indigo-650">{exp.company}</span>
                          <span className="mx-2">•</span>
                          <span>{exp.period}</span>
                        </div>
                        {exp.description && (
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1.5">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic py-3">No verified career history records available.</p>
                )}
              </div>

              {/* Education History */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-4 flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-500" /> Academic Background {renderBadge('education')}
                </h2>
                
                {aiProfile?.education && aiProfile.education.length > 0 ? (
                  <div className="relative border-l-2 border-slate-100 pl-5 ml-2.5 space-y-6 py-2">
                    {aiProfile.education.map((edu: any, idx: number) => (
                      <div key={idx} className="relative flex flex-col gap-1">
                        <span className="absolute -left-[26px] top-1.5 h-3.5 w-3.5 rounded-full bg-purple-550 border-2 border-white shadow-sm" />
                        <h3 className="text-xs font-bold text-slate-900 leading-tight">{edu.degree}</h3>
                        <div className="flex items-center text-[10px] text-slate-555 font-bold">
                          <span className="text-purple-650">{edu.school}</span>
                          {edu.year && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Class of {edu.year}</span>
                            </>
                          )}
                        </div>
                        {edu.fieldOfStudy && (
                          <p className="text-[11px] text-slate-500 font-semibold mt-1">Field of Study: {edu.fieldOfStudy}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic py-3">No academic background logs found.</p>
                )}
              </div>
            </div>

            {/* Right Column: Collapsible metadata sections */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* Certifications Collapsible */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
                <button
                  onClick={() => toggleCollapsible('certifications')}
                  className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <span>Certifications</span>
                  {collapsibles.certifications ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {collapsibles.certifications && (
                  <div className="p-4 border-t border-slate-50">
                    {aiProfile?.certifications && aiProfile.certifications.length > 0 ? (
                      <ul className="list-disc list-inside text-xs font-semibold text-slate-600 space-y-1.5">
                        {aiProfile.certifications.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No certifications logged.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Achievements Collapsible */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
                <button
                  onClick={() => toggleCollapsible('achievements')}
                  className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <span>Key Achievements</span>
                  {collapsibles.achievements ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {collapsibles.achievements && (
                  <div className="p-4 border-t border-slate-50">
                    {aiProfile?.achievements && aiProfile.achievements.length > 0 ? (
                      <ul className="list-disc list-inside text-xs font-semibold text-slate-600 space-y-1.5">
                        {aiProfile.achievements.map((a: string, idx: number) => <li key={idx}>{a}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No custom achievements found.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Languages Collapsible */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
                <button
                  onClick={() => toggleCollapsible('languages')}
                  className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <span>Languages</span>
                  {collapsibles.languages ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {collapsibles.languages && (
                  <div className="p-4 border-t border-slate-50">
                    {aiProfile?.languages && aiProfile.languages.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {aiProfile.languages.map((l: string) => (
                          <span key={l} className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-650 rounded text-xs font-semibold">
                            {l}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No language proficiencies logged.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Interests Collapsible */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
                <button
                  onClick={() => toggleCollapsible('interests')}
                  className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <span>Interests & Hobbies</span>
                  {collapsibles.interests ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {collapsibles.interests && (
                  <div className="p-4 border-t border-slate-50">
                    {aiProfile?.interests && aiProfile.interests.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {aiProfile.interests.map((i: string) => (
                          <span key={i} className="px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold">
                            {i}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No interests detected.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI INTELLIGENCE TAB */}
        {activeTab === 'ai' && (
          <div className="flex flex-col gap-6 animate-slide-down text-slate-800">
            {!aiProfile && !aiParsedSummary && !isPipelineActive ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-100 rounded-xl bg-white">
                <div className="p-4 bg-purple-50 rounded-full mb-3 text-purple-500 animate-pulse">
                  <Cpu className="h-8 w-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Intelligence Generated</h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
                  We could not parse background intelligence metrics for this profile. Make sure the credentials are correct and refresh enrichment.
                </p>
              </div>
            ) : isPipelineActive ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-slate-100 rounded-xl bg-white">
                <div className="p-4 bg-indigo-50 text-indigo-550 rounded-full mb-3 animate-spin">
                  <Loader2 className="h-8 w-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-850 uppercase tracking-widest">{enrichmentStatus.replace('_', ' ')}</h3>
                <p className="text-xs text-slate-450 mt-1 max-w-sm">
                  The OSINT public search & AI summary engine is active. Please hold...
                </p>
              </div>
            ) : (
              <>
                {/* Scoring Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Verification Confidence Gauge */}
                  <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col justify-between items-center text-center">
                    <div>
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {verificationStatus || 'Verified'}
                      </span>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-3">Candidate Identity Confidence</h4>
                    </div>
                    {verificationConfidence !== undefined && (
                      <div className="relative h-20 w-20 flex items-center justify-center mt-3">
                        <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" strokeWidth="2.5" stroke="#f1f5f9" fill="transparent" />
                          <circle cx="18" cy="18" r="16" strokeWidth="2.5" 
                            stroke={verificationStatus && verificationStatus.includes('Failed') ? '#f59e0b' : '#10b981'} 
                            fill="transparent" 
                            strokeDasharray={2 * Math.PI * 16}
                            strokeDashoffset={2 * Math.PI * 16 * (1 - verificationConfidence / 100)} 
                          />
                        </svg>
                        <span className="text-base font-black text-slate-900">{verificationConfidence.toFixed(0)}%</span>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2">Evaluation based on name, website, and title alignment checks.</p>
                  </div>

                  {/* Decision Maker Score card */}
                  <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col justify-between items-center text-center">
                    <div>
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-750 border border-purple-100">
                        {scoreTier}
                      </span>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-3">Decision Maker Score</h4>
                    </div>
                    <div className="relative h-20 w-20 flex items-center justify-center mt-3">
                      <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" strokeWidth="2.5" stroke="#f1f5f9" fill="transparent" />
                        <circle cx="18" cy="18" r="16" strokeWidth="2.5" strokeLinecap="round"
                          stroke={scoreGaugeColor.replace('stroke-', '#')} 
                          fill="transparent" 
                          strokeDasharray={2 * Math.PI * 16}
                          strokeDashoffset={2 * Math.PI * 16 * (1 - score / 100)} 
                        />
                      </svg>
                      <span className="text-lg font-black text-slate-900">{score}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Target authority score derived from organizational role.</p>
                  </div>

                  {/* Decision Maker Tier Explanation */}
                  <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Scoring Context</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-2">
                        {scoreExplanation}
                      </p>
                    </div>
                    <div className="border-t border-slate-50 pt-2 mt-2">
                      <span className="text-[9px] text-slate-400 uppercase font-bold">Key Indicator:</span>
                      <p className="text-[10px] text-slate-650 font-bold mt-1 truncate">{scoreFactors[0]}</p>
                    </div>
                  </div>
                </div>

                {/* AI Professional Summary Card */}
                {aiParsedSummary?.executiveSummary && (
                  <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2 mb-3">AI Executive Briefing</h4>
                    <p className="text-xs text-slate-650 font-semibold leading-relaxed">
                      {aiParsedSummary.executiveSummary}
                    </p>
                  </div>
                )}

                {/* Networking Suggestions & Starters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Conversation Starters */}
                  {aiParsedSummary?.conversationStarters && aiParsedSummary.conversationStarters.length > 0 && (
                    <div className="p-5 bg-gradient-to-br from-indigo-50/20 to-white border border-indigo-100/50 rounded-xl shadow-xs">
                      <h4 className="text-xs font-black text-indigo-900 mb-3.5 flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-indigo-500" /> Conversation Starters
                      </h4>
                      <div className="space-y-2">
                        {aiParsedSummary.conversationStarters.map((starter: string, idx: number) => (
                          <div key={idx} className="p-3 bg-white border border-indigo-50/40 rounded-lg shadow-sm">
                            <p className="text-xs text-slate-700 leading-relaxed font-semibold">"{starter}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Networking Strategy */}
                  <div className="flex flex-col gap-6">
                    {aiParsedSummary?.networkingSuggestions && (
                      <div className="p-5 bg-gradient-to-br from-purple-50/20 to-white border border-purple-100/50 rounded-xl shadow-xs">
                        <h4 className="text-xs font-black text-purple-900 mb-3 flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-purple-500" /> Networking Strategy
                        </h4>
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                          {aiParsedSummary.networkingSuggestions}
                        </p>
                      </div>
                    )}

                    {/* Professional Strengths */}
                    {aiParsedSummary?.professionalStrengths && aiParsedSummary.professionalStrengths.length > 0 && (
                      <div className="p-5 bg-white border border-slate-100 rounded-xl shadow-xs">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Key Strengths</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {aiParsedSummary.professionalStrengths.map((str: string, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold">
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
                  <div className="p-5 bg-gradient-to-br from-emerald-50/20 to-white border border-emerald-100/50 rounded-xl shadow-xs">
                    <h4 className="text-xs font-black text-emerald-900 mb-3 flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-emerald-500" /> Meeting Preparation Checklist
                    </h4>
                    <p className="text-xs text-slate-650 font-semibold leading-relaxed whitespace-pre-line">
                      {aiParsedSummary.meetingPreparation}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PROFILE DISCOVERY TAB */}
        {activeTab === 'discovery' && (
          <div className="space-y-6 animate-slide-down">
            {Object.keys(groupedCandidates).length === 0 ? (
              <div className="bg-white p-12 border border-slate-100 rounded-xl text-center flex flex-col items-center">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-full mb-3">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Discovered Profiles</h3>
                <p className="text-xs text-slate-450 mt-1 max-w-sm leading-relaxed">
                  The OSINT discovery pipeline has not returned online matching credentials. Run profile enrichment to search public directories.
                </p>
              </div>
            ) : (
              Object.entries(groupedCandidates).map(([platform, responses]) => (
                <div key={platform} className="space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest border-b border-slate-50 pb-1.5 flex items-center gap-2">
                    <span>•</span> {platform} Profiles ({responses.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {responses.map((resp: any, idx: number) => {
                      const cand = resp.data;
                      const isBest = idx === 0 && resp.confidence >= 70;
                      const profileUrl = cand.publicProfiles?.find((p: any) => p.platform.toLowerCase() === platform.toLowerCase() || p.platform === platform)?.url || cand.publicProfiles?.[0]?.url;

                      return (
                        <div key={idx} className={`p-4 rounded-xl border transition-all duration-300 shadow-sm flex flex-col justify-between bg-white group
                          ${isBest ? 'border-indigo-250 shadow-indigo-100/40 ring-1 ring-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border select-none
                                ${cand.verificationStatus === 'Verified' || resp.confidence >= 70
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                              >
                                {cand.verificationStatus || 'Unverified'}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border select-none
                                ${resp.confidence >= 70 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}
                              >
                                {resp.confidence}% Match
                              </span>
                            </div>

                            <div className="flex gap-3 items-center">
                              {cand.profileImage && (
                                <img src={cand.profileImage} alt={cand.fullName} className="h-10 w-10 rounded-full object-cover border border-slate-100" />
                              )}
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-slate-800 flex items-center truncate">
                                  {cand.fullName || contact.name}
                                  {isBest && (
                                    <span className="ml-1.5 inline-flex px-1.5 py-0.2 bg-indigo-650 text-white rounded text-[8px] font-black uppercase tracking-wider select-none">
                                      Best
                                    </span>
                                  )}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                                  {cand.designation || cand.headline || 'Professional Profile'}
                                </p>
                              </div>
                            </div>
                            
                            {cand.company && (
                              <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-wide">
                                Organization: {cand.company}
                              </p>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100/60 flex items-center justify-between">
                            {profileUrl ? (
                              <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-650 hover:underline">
                                View Profile <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium italic">No URL linked</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedCandidate(cand)}
                              className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded transition-colors"
                            >
                              Expand Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ACTIVITY & NOTES TAB */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-down">
            
            {/* Left Column: Notes & Timeline */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Meeting Notes */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col gap-4">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2">
                  Meeting Notes
                </h2>
                
                <form onSubmit={handleAddNote} className="flex gap-2.5 items-end">
                  <div className="flex-1">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add brief summaries, conversation feedback..."
                      rows={2}
                      className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg p-2 text-xs outline-none resize-none"
                    />
                  </div>
                  <Button type="submit" isLoading={addNoteMutation.isPending} className="flex items-center gap-1.5 h-9 px-4 text-xs font-bold">
                    <Plus className="h-4 w-4" /> Save
                  </Button>
                </form>

                {contact.notes && contact.notes.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {contact.notes.map((note) => (
                      <div key={note.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 leading-relaxed font-semibold">{note.content}</p>
                          <span className="text-[9px] text-slate-400 mt-2 block font-bold">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => setNoteToDelete({ contactId: contact.id, noteId: note.id })}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete Note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-6">No custom notes documented.</p>
                )}
              </div>

              {/* Field Verification Attribution */}
              {contact.professionalProfile?.sourceAttribution && Object.keys(contact.professionalProfile.sourceAttribution).length > 0 && (
                <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                  <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-3">
                    Field-Level Verification Attribution
                  </h2>
                  <div className="overflow-x-auto border border-slate-50 rounded-lg">
                    <table className="min-w-full text-left text-xs text-slate-500">
                      <thead className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3">Field</th>
                          <th className="py-2.5 px-3">Verified Source</th>
                          <th className="py-2.5 px-3">Confidence</th>
                          <th className="py-2.5 px-3">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                        {Object.entries(contact.professionalProfile.sourceAttribution).map(([field, attr]: [string, any]) => (
                          <tr key={field} className="hover:bg-slate-50/20">
                            <td className="py-2.5 px-3 text-indigo-650 font-bold capitalize">{field.replace(/([A-Z])/g, ' $1')}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-medium">{attr.source}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold border
                                ${attr.confidence >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {attr.confidence}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold border
                                ${attr.verification === 'Verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                                {attr.verification}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Search Timelines */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Timeline Audit Logs */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-4">
                  Audit Activity Timeline
                </h2>
                {timeline && timeline.length > 0 ? (
                  <div className="relative border-l border-slate-100 pl-4 ml-2.5 space-y-4 py-1 max-h-[300px] overflow-y-auto">
                    {timeline.map((log) => {
                      let logTitle = log.action.toLowerCase().replace(/_/g, ' ');
                      let logDesc = '';

                      if (log.action === 'OCR_PROCESSING_COMPLETED') {
                        logTitle = 'Ingested via Card Scanner';
                        logDesc = 'Parsed details from physical business card image upload.';
                      } else if (log.action === 'CONTACT_CREATED_FROM_OCR') {
                        logTitle = 'Contact Profile created';
                        logDesc = 'Auto-created database contact record following OCR extraction.';
                      } else if (log.action === 'FACE_RECOGNITION_MATCHED') {
                        logTitle = 'Face Match Ingestion';
                        logDesc = `Verified identity with similarity score of ${((log.details?.similarityScore || 0) * 100).toFixed(0)}%.`;
                      } else if (log.action === 'PROFILE_ENRICHED') {
                        logTitle = 'OSINT Search grounding complete';
                        logDesc = 'Synced details across verified LinkedIn/GitHub search indices.';
                      } else if (log.action === 'AI_SUMMARY_GENERATED') {
                        logTitle = 'AI Summarization generated';
                        logDesc = 'Briefed executive summary paragraph details.';
                      }

                      return (
                        <div key={log.id} className="relative flex flex-col gap-1">
                          <span className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow-xs flex items-center justify-center">
                            <Activity className="h-1 text-white" />
                          </span>
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black text-slate-800 capitalize leading-none">{logTitle}</span>
                            <span className="text-[9px] text-slate-400 font-bold">{new Date(log.createdAt).toLocaleDateString()}</span>
                          </div>
                          {logDesc && <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed font-semibold">{logDesc}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-3 text-center">No timeline records generated.</p>
                )}
              </div>

              {/* Search Log Timeline */}
              {(() => {
                const searchProcess = contact.professionalProfile?.mergedProfile?.searchProcess?.value || 
                                      contact.professionalProfile?.sourceAttribution?.searchProcess?.value;
                if (!searchProcess || Object.keys(searchProcess).length === 0) return null;
                return (
                  <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                    <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-3 flex items-center gap-1.5">
                      <Search className="h-4 w-4 text-slate-400" /> Search Engine Query Logs
                    </h2>
                    <div className="relative border-l border-slate-100 ml-2.5 pl-5 space-y-3 py-1">
                      {Object.entries(searchProcess).map(([provider, results]: any, idx) => {
                        const hasResult = results && !results.includes('0 Results') && !results.includes('Disabled');
                        return (
                          <div key={idx} className="relative flex items-center justify-between">
                            <span className={`absolute -left-[27px] top-1.5 rounded-full h-2.5 w-2.5 border
                              ${hasResult ? 'bg-indigo-500 border-white' : 'bg-slate-350 border-white'}`}
                            />
                            <span className="text-xs font-bold text-slate-700">{provider}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border
                              ${hasResult ? 'bg-indigo-50 text-indigo-700 border-indigo-150' : 'bg-slate-50 text-slate-450 border-slate-150'}`}
                            >
                              {results}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* CONFIRM DELETE NOTE MODAL */}
      <ConfirmModal
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleDeleteNote}
        title="Delete Meeting Note"
        message="Are you sure you want to delete this documented note? This action is permanent."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteNoteMutation.isPending}
      />

      {/* RIGHT SIDE CANDIDATE DETAIL DRAWER */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay blur */}
          <div 
            onClick={() => setSelectedCandidate(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
          />

          {/* Drawer container panel */}
          <div className="absolute inset-y-0 right-0 max-w-xl w-full bg-white shadow-2xl flex flex-col animate-slide-in-right z-50">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                {selectedCandidate.profileImage && (
                  <img src={selectedCandidate.profileImage} alt={selectedCandidate.fullName} className="h-10 w-10 rounded-full object-cover border border-slate-150 shadow-sm" />
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-900">{selectedCandidate.fullName}</h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-650 bg-indigo-50 px-2 py-0.5 border border-indigo-150 rounded">
                    Source: {selectedCandidate.source}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCandidate(null)}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* About candidate biography */}
              {(selectedCandidate.summary || selectedCandidate.companyBio) && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biography</h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold bg-slate-50 p-4 border border-slate-100 rounded-xl">
                    {selectedCandidate.summary || selectedCandidate.companyBio}
                  </p>
                </div>
              )}

              {/* Career timeline */}
              {selectedCandidate.experience && selectedCandidate.experience.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Experience
                  </h4>
                  <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-4">
                    {selectedCandidate.experience.map((exp: any, idx: number) => (
                      <div key={idx} className="relative flex flex-col gap-0.5">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-450 border-2 border-white" />
                        <h5 className="text-xs font-bold text-slate-800">{exp.title}</h5>
                        <p className="text-[10px] text-slate-500 font-bold">
                          <span className="text-indigo-650">{exp.company}</span> • <span>{exp.period}</span>
                        </p>
                        {exp.description && (
                          <p className="text-[10px] text-slate-450 font-medium leading-relaxed mt-1">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Academic timeline */}
              {selectedCandidate.education && selectedCandidate.education.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" /> Education
                  </h4>
                  <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-4">
                    {selectedCandidate.education.map((edu: any, idx: number) => (
                      <div key={idx} className="relative flex flex-col gap-0.5">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400 border-2 border-white" />
                        <h5 className="text-xs font-bold text-slate-800">{edu.degree}</h5>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          <span className="text-purple-650">{edu.school}</span> {edu.year && `• Class of ${edu.year}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCandidate.skills.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-650 rounded text-xs font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* GitHub Repositories */}
              {selectedCandidate.repositories && selectedCandidate.repositories.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <FolderGit2 className="h-3.5 w-3.5" /> Public Repositories ({selectedCandidate.repositories.length})
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {selectedCandidate.repositories.map((repo: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <a href={repo.url} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-650 hover:underline truncate block">
                            {repo.name}
                          </a>
                          {repo.description && <p className="text-[10px] text-slate-450 mt-1 font-semibold leading-relaxed line-clamp-2">{repo.description}</p>}
                        </div>
                        <div className="text-right shrink-0 flex flex-col gap-1 items-end">
                          {repo.language && <span className="px-1.5 py-0.2 bg-blue-50 border border-blue-150 text-blue-600 rounded text-[9px] font-bold">{repo.language}</span>}
                          <span className="text-[9px] text-slate-400 font-bold">⭐ {repo.stars} stars</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
