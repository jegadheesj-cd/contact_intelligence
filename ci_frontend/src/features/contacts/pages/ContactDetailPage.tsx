import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { parseBiography, formatGroundedBio } from '../utils/biographyParser';
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
  Heart,
  Building2,
  GraduationCap,
  ArrowRight,
  Shield,
  Clock,
} from 'lucide-react';

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4.06 4.06 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const Facebook = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const Youtube = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" />
    <polygon points="9.7 15 15.2 12 9.7 9" />
  </svg>
);

interface CountUpProps {
  end: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}

const CountUp: React.FC<CountUpProps> = ({ end, decimals = 0, suffix = '', duration = 750 }) => {
  const safeEnd = typeof end === 'number' ? end : 0;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = progress * safeEnd;
      setCount(current);
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(safeEnd);
      }
    };
    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [safeEnd, duration]);

  return <span>{(count ?? 0).toFixed(decimals)}{suffix}</span>;
};

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
  
  // Expanded platforms state for View X More toggle
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

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
  }, [contact]);  // Derived profile helper values (safe for loading/error states)
  const rawProfile = contact?.professionalProfile?.mergedProfile as any;
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

  const parsedBio = useMemo(() => {
    if (!contact) return { experience: [], education: [] };
    const getBiographyText = () => {
      if (aiProfile?.summary) return aiProfile.summary;
      if (aiProfile?.companyBio) return aiProfile.companyBio;
      const responses = contact.professionalProfile?.providerResponses;
      if (Array.isArray(responses)) {
        for (const resp of responses) {
          if (resp.summary) return resp.summary;
          if (resp.companyBio) return resp.companyBio;
        }
      }
      return '';
    };
    const bioText = getBiographyText();
    return parseBiography(bioText);
  }, [contact, aiProfile]);

  const experiencesToDisplay = useMemo(() => {
    if (aiProfile?.experience && aiProfile.experience.length > 0) {
      return aiProfile.experience;
    }
    return parsedBio.experience;
  }, [aiProfile?.experience, parsedBio.experience]);

  const educationToDisplay = useMemo(() => {
    if (aiProfile?.education && aiProfile.education.length > 0) {
      return aiProfile.education;
    }
    return parsedBio.education;
  }, [aiProfile?.education, parsedBio.education]);

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
  const getPlatformName = (source?: string) => {
    if (!source) return 'Other Platforms';
    const s = source.toLowerCase();
    if (s.includes('linkedin')) return 'LinkedIn';
    if (s.includes('github')) return 'GitHub';
    if (s.includes('website') || s.includes('cheerio') || s.includes('company')) return 'Company Website';
    if (s.includes('portfolio')) return 'Portfolio';
    if (s.includes('twitter') || s.includes('x.com')) return 'Twitter/X';
    if (s.includes('instagram')) return 'Instagram';
    if (s.includes('facebook')) return 'Facebook';
    if (s.includes('youtube')) return 'YouTube';
    return 'Other Platforms';
  };

  const groupCandidatesByPlatform = () => {
    const responses = contact.professionalProfile?.providerResponses;
    
    const groups: Record<string, any[]> = {
      'LinkedIn': [],
      'Company Website': [],
      'GitHub': [],
      'Portfolio': []
    };
    
    if (responses && Array.isArray(responses)) {
      responses.forEach((resp) => {
        if (resp.success === false || !resp.sourceName) return;
        if (resp.confidence < 40) return;

        const platform = getPlatformName(resp.sourceName);
        if (!groups[platform]) groups[platform] = [];
        groups[platform].push(resp);
      });
    }
    return groups;
  };

  const groupedCandidates = enrichmentStatus === 'FAILED' ? {} : groupCandidatesByPlatform();

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
      <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          {aiProfile?.profileImage ? (
            <div className="h-16 w-16 rounded-2xl border border-indigo-200/60 shrink-0 shadow-xs relative overflow-hidden">
              <img src={aiProfile.profileImage} alt={contact.name} className="h-full w-full object-cover" onError={(e) => { (e.target as any).style.display = 'none'; (e.target as any).parentElement.innerHTML = `<div class="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-black text-xl">${initials}</div>`; }} />
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-emerald-500 border-2 border-white rounded-full" title="Active Contact" />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-100 to-purple-100 border border-indigo-200/60 text-indigo-700 flex items-center justify-center font-black text-xl tracking-wide shrink-0 shadow-xs relative">
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-emerald-500 border-2 border-white rounded-full" title="Active Contact" />
              {initials}
            </div>
          )}
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 leading-tight truncate">{contact.name}</h1>
              {verificationStatus && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/60 text-[9px] font-extrabold rounded-full select-none">
                  {verificationStatus}
                </span>
              )}
            </div>
            
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5 font-semibold">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{contact.designation || 'No title'} {contact.company ? `@ ${contact.company}` : ''}</span>
            </p>

            {/* Platform Quick Links */}
            <div className="flex items-center gap-2 mt-2">
              {contact.website && (
                <a
                  href={contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 bg-slate-50 border border-slate-150 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-md text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                >
                  <Globe className="h-3 w-3" /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black border select-none ${scoreBg} shadow-xs`}>
            <span>Decision Score:</span>
            <span className="font-mono text-sm bg-white/70 px-1.5 py-0.2 rounded-md border border-slate-200/50">{score}%</span>
          </div>
          
          {isPipelineActive && (
            <span className="inline-flex px-2.5 py-1.5 rounded-xl text-[9px] font-black border bg-blue-50 text-blue-700 border-blue-200 animate-pulse uppercase tracking-wider">
              {enrichmentStatus.replace('_', ' ')}...
            </span>
          )}
          
          <Button
            onClick={handleTriggerEnrichment}
            isLoading={enrichMutation.isPending || isPipelineActive}
            className="flex items-center gap-1.5 py-2 px-4 text-xs shadow-xs font-bold bg-indigo-650 hover:bg-indigo-700 text-white cursor-pointer"
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
      {(() => {
        const isConfirmed = contact.overviewConfirmed || (contact.professionalProfile && !['PENDING'].includes(contact.professionalProfile.enrichmentStatus || 'PENDING'));
        const tabs = [
          { key: 'overview', label: 'Overview', locked: false },
          { key: 'discovery', label: 'Profile Discovery', locked: !isConfirmed },
          { key: 'career', label: 'Experience & Education', locked: !isConfirmed },
          { key: 'ai', label: '✨ AI Intelligence', locked: !isConfirmed },
          { key: 'activity', label: 'Activity & Notes', locked: !isConfirmed },
        ];
        return (
      <div className="border-b border-slate-200 flex gap-4 shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { if (!tab.locked) setActiveTab(tab.key as any); }}
            disabled={tab.locked}
            className={`py-2 px-1 text-xs font-bold uppercase tracking-wider border-b-2 outline-none transition-all whitespace-nowrap
              ${tab.locked ? 'border-transparent text-slate-300 cursor-not-allowed opacity-50' :
                activeTab === tab.key
                  ? tab.key === 'ai' ? 'border-purple-600 text-purple-700' : 'border-indigo-650 text-indigo-650'
                  : tab.key === 'ai' ? 'border-transparent text-purple-400 hover:text-purple-650' : 'border-transparent text-slate-450 hover:text-slate-650'
              }`}
          >
            {tab.locked && <Shield className="h-3 w-3 inline mr-1 opacity-40" />}
            {tab.label}
          </button>
        ))}
      </div>
        );
      })()}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-h-[420px]">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in animate-slide-up">
            
            {/* Left Column: Basic editable info card */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col gap-4">
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
                  {renderInlineEditRow('linkedInUrl', 'LinkedIn URL', <LinkedinIcon className="h-3.5 w-3.5 text-slate-400" />, (() => {
                    const profiles = aiProfile?.publicProfiles;
                    if (Array.isArray(profiles)) {
                      const li = profiles.find((p: any) => p.platform === 'LinkedIn');
                      return li?.url || '';
                    }
                    return '';
                  })())}
                </div>
              </div>

              {/* ScrapeCreators Social Details Card */}
              {aiProfile?.scrapeCreatorsData && aiProfile.scrapeCreatorsData.length > 0 && (
                <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col gap-5 animate-fade-in animate-slide-up">
                  <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2">
                    Social Channels Insights
                  </h2>
                  <div className="flex flex-col gap-6">
                    {aiProfile.scrapeCreatorsData.map((social: any, idx: number) => {
                      const isInstagram = social.platform === 'Instagram';
                      const isFacebook = social.platform === 'Facebook';
                      const isYouTube = social.platform === 'YouTube';
                      
                      let themeColor = 'from-slate-50 to-white border-slate-100 text-slate-700';
                      let icon = <Globe className="h-4 w-4 text-slate-400" />;
                      
                      if (isInstagram) {
                        themeColor = 'from-pink-50/20 to-white border-pink-100/50 text-pink-700';
                        icon = <Instagram className="h-4 w-4 text-pink-500" />;
                      } else if (isFacebook) {
                        themeColor = 'from-blue-50/20 to-white border-blue-100/50 text-blue-700';
                        icon = <Facebook className="h-4 w-4 text-blue-500" />;
                      } else if (isYouTube) {
                        themeColor = 'from-red-50/20 to-white border-red-100/50 text-red-750';
                        icon = <Youtube className="h-4 w-4 text-red-650" />;
                      }
                      
                      return (
                        <div key={idx} className={`p-4 bg-gradient-to-br ${themeColor} border rounded-xl shadow-sm hover:scale-[1.01] transition-transform duration-300`}>
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <div className="flex gap-3 items-center min-w-0">
                              {social.profileImageUrl ? (
                                <img
                                  src={social.profileImageUrl}
                                  alt={social.displayName || social.username}
                                  className="h-10 w-10 rounded-full object-cover border border-slate-100 shadow-sm"
                                  onError={(e) => {
                                    (e.target as any).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                  {icon}
                                </div>
                              )}
                              <div className="min-w-0">
                                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 truncate">
                                  {social.displayName || social.username || `${social.platform} Profile`}
                                  {social.verified && (
                                    <span className="inline-flex h-3.5 w-3.5 bg-blue-500 text-white rounded-full text-[8px] items-center justify-center font-black select-none" title="Verified Badge">
                                      ✓
                                    </span>
                                  )}
                                </h3>
                                {social.username && (
                                  <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                                    @{social.username}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <a
                              href={social.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 bg-white border border-slate-200 hover:border-slate-350 text-slate-500 rounded-lg hover:text-slate-800 transition-colors shadow-sm shrink-0 cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>

                          {social.bio && (
                            <p className="text-xs text-slate-650 leading-relaxed font-medium mt-2 bg-white/40 p-2.5 rounded-lg border border-slate-100/50">
                              {social.bio}
                            </p>
                          )}

                          <div className="grid grid-cols-3 gap-2 mt-3.5 border-t border-slate-100/55 pt-3 text-center">
                            {social.followersCount !== undefined && (
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase">
                                  {isYouTube ? 'Subscribers' : 'Followers'}
                                </span>
                                <span className="text-xs font-black text-slate-850">
                                  {social.followersCount.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {social.followingCount !== undefined && !isYouTube && (
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase">Following</span>
                                <span className="text-xs font-black text-slate-850">
                                  {social.followingCount.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {social.postCount !== undefined && !isYouTube && (
                              <div>
                                <span className="text-[9px] text-slate-400 block font-bold uppercase">Posts</span>
                                <span className="text-xs font-black text-slate-850">
                                  {social.postCount.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {social.category && (
                              <div className="col-span-3 mt-2 text-left flex items-center gap-1.5">
                                <span className="text-[9px] text-slate-400 uppercase font-black">Category:</span>
                                <span className="text-[10px] bg-slate-50 border border-slate-250 px-2 py-0.5 rounded text-slate-750 font-bold">
                                  {social.category}
                                </span>
                              </div>
                            )}
                            {social.location && (
                              <div className="col-span-3 mt-1.5 text-left text-[10px] text-slate-500 font-semibold">
                                <MapPin className="h-3 w-3 inline mr-1 text-slate-400" /> {social.location}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: AI Merged Summary & Skills */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Grounded AI Bio */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-3">
                  AI Grounded Bio
                </h2>
                {aiProfile?.summary || aiProfile?.companyBio ? (
                  <p className="text-xs text-slate-650 leading-relaxed font-semibold border-l-2 border-indigo-250 pl-3.5 italic bg-slate-50/20 py-2 rounded-r-lg whitespace-pre-line" style={{ whiteSpace: 'pre-line' }}>
                    {formatGroundedBio(aiProfile.summary || aiProfile.companyBio, experiencesToDisplay, educationToDisplay, contact.designation, contact.company)}
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

            {/* Confirm & Proceed CTA */}
            {(() => {
              const isConfirmed = contact.overviewConfirmed || (contact.professionalProfile && !['PENDING'].includes(contact.professionalProfile?.enrichmentStatus || 'PENDING'));
              if (isConfirmed) return null;
              return (
                <div className="lg:col-span-12">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 shrink-0">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">Confirm Contact Details</h3>
                        <p className="text-xs text-slate-500 mt-1 font-semibold max-w-md">
                          Verify the contact's basic credentials above, then proceed to trigger profile discovery and AI enrichment.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!id) return;
                        if (isPipelineActive || enrichMutation.isPending) return;
                        try {
                          await updateContactMutation.mutateAsync({ id, data: { overviewConfirmed: true } });
                          addToast('Contact confirmed. Triggering profile enrichment...', 'success');
                          setActiveTab('discovery');
                          if (enrichmentStatus === 'PENDING') {
                            await enrichMutation.mutateAsync(id);
                            setIsEnrichmentActive(true);
                          }
                        } catch (err: any) {
                          addToast(err.message || 'Failed to confirm contact.', 'error');
                        }
                      }}
                      disabled={isPipelineActive || enrichMutation.isPending}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all shadow-sm cursor-pointer
                        ${isPipelineActive || enrichMutation.isPending
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'}`}
                    >
                      {isPipelineActive || enrichMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                      ) : (
                        <><ArrowRight className="h-4 w-4" /> Confirm & Proceed</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* CAREER & EDUCATION TAB */}
        {activeTab === 'career' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in animate-slide-up">
            
            {/* Left Column: Timelines */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Grouped Career Timeline */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-4 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-500" /> Career History {renderBadge('experience')}
                </h2>
                
                {experiencesToDisplay && experiencesToDisplay.length > 0 ? (
                  (() => {
                    // Group experiences by company
                    const groups: Record<string, any[]> = {};
                    const order: string[] = [];
                    experiencesToDisplay.forEach((exp: any) => {
                      const compKey = (exp.company || 'Other').trim();
                      if (!groups[compKey]) { groups[compKey] = []; order.push(compKey); }
                      groups[compKey].push(exp);
                    });

                    return (
                      <div className="space-y-6">
                        {order.map((company, gIdx) => {
                          const roles = groups[company];
                          const logo = roles[0]?.companyLogo;
                          return (
                            <div key={gIdx} className="animate-slide-up opacity-0" style={{ animationDelay: `${gIdx * 60}ms`, animationFillMode: 'forwards' }}>
                              {/* Company Header */}
                              <div className="flex items-center gap-3 mb-3">
                                {logo ? (
                                  <img src={logo} alt={company} className="h-9 w-9 rounded-lg object-contain border border-slate-100 bg-white p-0.5 shadow-xs" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                    <Building2 className="h-4 w-4 text-indigo-400" />
                                  </div>
                                )}
                                <div>
                                  <h3 className="text-xs font-black text-slate-800">{company}</h3>
                                  <p className="text-[10px] text-slate-400 font-semibold">{roles.length} role{roles.length > 1 ? 's' : ''}</p>
                                </div>
                              </div>
                              {/* Roles Timeline */}
                              <div className="relative border-l-2 border-indigo-100 pl-5 ml-4 space-y-4">
                                {roles.map((exp: any, idx: number) => {
                                  const displayPeriod = exp.period || (exp.startDate ? `${exp.startDate}${exp.endDate ? ` – ${exp.endDate}` : ' – Present'}` : '');
                                  return (
                                    <div key={idx} className="relative flex flex-col gap-0.5">
                                      <span className={`absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-white shadow-sm ${exp.isCurrent ? 'bg-emerald-500' : 'bg-indigo-400'}`} />
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold text-slate-900">{exp.title || exp.designation || 'Professional Role'}</h4>
                                        {exp.isCurrent && (
                                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-black rounded-full uppercase">Current</span>
                                        )}
                                      </div>
                                      <div className="flex items-center flex-wrap gap-x-2 text-[10px] text-slate-500 font-semibold">
                                        {displayPeriod && <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {displayPeriod}</span>}
                                        {exp.duration && <span>• {exp.duration}</span>}
                                        {exp.location && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {exp.location}</span>}
                                      </div>
                                      {exp.description && (
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{exp.description}</p>
                                      )}
                                      {exp.skills && Array.isArray(exp.skills) && exp.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {exp.skills.map((s: string, si: number) => (
                                            <span key={si} className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-bold">{s}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : isPipelineActive ? (
                  <div className="flex items-center gap-3 py-6 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    <span className="text-xs text-slate-400 font-semibold">Loading career data from enrichment pipeline...</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic py-3">No verified career history records available.</p>
                )}
              </div>

              {/* Education History */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-4 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-purple-500" /> Academic Background {renderBadge('education')}
                </h2>
                
                {educationToDisplay && educationToDisplay.length > 0 ? (
                  <div className="relative border-l-2 border-purple-100 pl-5 ml-2.5 space-y-6 py-2">
                    {educationToDisplay.map((edu: any, idx: number) => {
                      const displayYear = edu.year || (edu.startDate ? `${edu.startDate}${edu.endDate ? ` – ${edu.endDate}` : ''}` : '');
                      return (
                        <div key={idx} className="relative flex flex-col gap-0.5 animate-slide-up opacity-0" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'forwards' }}>
                          <span className="absolute -left-[26px] top-1.5 h-3.5 w-3.5 rounded-full bg-purple-500 border-2 border-white shadow-sm" />
                          <h3 className="text-xs font-bold text-slate-900 leading-tight">{edu.degree || edu.fieldOfStudy || 'Academic Program'}</h3>
                          <div className="flex items-center text-[10px] text-slate-555 font-bold">
                            {edu.school && <span className="text-purple-650">{edu.school}</span>}
                            {edu.school && displayYear && <span className="mx-2">•</span>}
                            {displayYear && <span>{displayYear}</span>}
                          </div>
                          {edu.fieldOfStudy && edu.degree && (
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Field of Study: {edu.fieldOfStudy}</p>
                          )}
                          {edu.description && (
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{edu.description}</p>
                          )}
                          {edu.activities && (
                            <p className="text-[10px] text-slate-450 font-medium mt-1 italic">Activities: {edu.activities}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : isPipelineActive ? (
                  <div className="flex items-center gap-3 py-6 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                    <span className="text-xs text-slate-400 font-semibold">Loading education data from enrichment pipeline...</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic py-3">No academic background logs found.</p>
                )}
              </div>

              {/* Clubs, Organizations & Volunteering */}
              <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase border-b border-slate-50 pb-2 mb-4 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" /> Clubs, Organizations & Volunteering
                </h2>
                
                {(() => {
                  const orgs: any[] = aiProfile?.organizations || [];
                  const vols: any[] = aiProfile?.volunteerExperience || [];
                  const hasData = orgs.length > 0 || vols.length > 0;

                  if (!hasData && isPipelineActive) {
                    return (
                      <div className="flex items-center gap-3 py-6 justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-rose-400" />
                        <span className="text-xs text-slate-400 font-semibold">Loading organizations data...</span>
                      </div>
                    );
                  }

                  if (!hasData) {
                    return (
                      <div className="text-center py-6">
                        <div className="p-3 bg-slate-50 rounded-full inline-flex mb-2">
                          <Users className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-xs text-slate-400 italic">No organizations, clubs, or volunteering activities discovered for this contact.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {orgs.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Organizations & Associations</h3>
                          <div className="space-y-2">
                            {orgs.map((org: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-lg">
                                <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-500 shrink-0 mt-0.5">
                                  <Building2 className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-800">{org.name || 'Unknown Organization'}</h4>
                                  {org.role && <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{org.role}</p>}
                                  {org.period && <p className="text-[10px] text-slate-400 font-medium">{org.period}</p>}
                                  {org.description && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{org.description}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {vols.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Volunteering & Community</h3>
                          <div className="space-y-2">
                            {vols.map((vol: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 p-3 bg-rose-50/30 border border-rose-100/50 rounded-lg">
                                <div className="p-1.5 bg-rose-50 rounded-md text-rose-500 shrink-0 mt-0.5">
                                  <Heart className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-800">{vol.name || 'Unknown Organization'}</h4>
                                  {vol.role && <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{vol.role}</p>}
                                  {vol.period && <p className="text-[10px] text-slate-400 font-medium">{vol.period}</p>}
                                  {vol.description && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{vol.description}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                  <div className="p-4 border-t border-slate-50 animate-fade-in animate-slide-up">
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
                  <div className="p-4 border-t border-slate-50 animate-fade-in animate-slide-up">
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
                  <div className="p-4 border-t border-slate-50 animate-fade-in animate-slide-up">
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
                  <div className="p-4 border-t border-slate-50 animate-fade-in animate-slide-up">
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
          <div className="flex flex-col gap-6 animate-fade-in animate-slide-up text-slate-800">
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
              <div className="flex flex-col items-center justify-center p-12 text-center border border-slate-100/80 rounded-xl bg-white animate-fade-in shadow-xs">
                <div className="p-4 bg-indigo-50/50 text-indigo-650 rounded-full mb-4 animate-pulse border border-indigo-100">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-1">
                  AI Enrichment Pipeline Active
                </h3>
                <p className="text-xs text-slate-450 max-w-sm mb-6 font-semibold">
                  Currently running public directory searches, OSINT parsing, and summary synthesis.
                </p>
                
                {/* Pipeline visualizer steps */}
                <div className="w-full max-w-xs space-y-3.5 text-left border-t border-slate-50 pt-5">
                  {[
                    { label: 'Queueing Pipeline', active: ['QUEUED'].includes(enrichmentStatus), done: ['PROCESSING', 'FETCHING_PROFILE', 'VERIFYING', 'GENERATING_SUMMARY', 'COMPLETED'].includes(enrichmentStatus) },
                    { label: 'OSINT Search & Profile Discovery', active: ['PROCESSING', 'FETCHING_PROFILE'].includes(enrichmentStatus), done: ['VERIFYING', 'GENERATING_SUMMARY', 'COMPLETED'].includes(enrichmentStatus) },
                    { label: 'Identity Verification Alignment', active: ['VERIFYING'].includes(enrichmentStatus), done: ['GENERATING_SUMMARY', 'COMPLETED'].includes(enrichmentStatus) },
                    { label: 'AI Grounded Summary Synthesis', active: ['GENERATING_SUMMARY'].includes(enrichmentStatus), done: ['COMPLETED'].includes(enrichmentStatus) }
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border text-[9px] font-black
                        ${step.done 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs shadow-emerald-500/20' 
                          : step.active 
                            ? 'bg-indigo-600 border-indigo-600 text-white animate-pulse shadow-xs shadow-indigo-600/20' 
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        {step.done ? '✓' : idx + 1}
                      </div>
                      <span className={`text-[11px] font-bold transition-all duration-200
                        ${step.done 
                          ? 'text-slate-500 line-through' 
                          : step.active 
                            ? 'text-indigo-650 font-black' 
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
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
                    {verificationConfidence != null && (
                      <div className="relative h-20 w-20 flex items-center justify-center mt-3">
                        <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" strokeWidth="2.5" stroke="#f1f5f9" fill="transparent" />
                          <circle cx="18" cy="18" r="16" strokeWidth="2.5" className="transition-all duration-1000 ease-out"
                            stroke={verificationStatus && verificationStatus.includes('Failed') ? '#f59e0b' : '#10b981'} 
                            fill="transparent" 
                            strokeDasharray={2 * Math.PI * 16}
                            strokeDashoffset={2 * Math.PI * 16 * (1 - verificationConfidence / 100)} 
                          />
                        </svg>
                        <span className="text-base font-black text-slate-900"><CountUp end={verificationConfidence} suffix="%" /></span>
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
                        <circle cx="18" cy="18" r="16" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-1000 ease-out"
                          stroke={scoreGaugeColor.replace('stroke-', '#')} 
                          fill="transparent" 
                          strokeDasharray={2 * Math.PI * 16}
                          strokeDashoffset={2 * Math.PI * 16 * (1 - score / 100)} 
                        />
                      </svg>
                      <span className="text-lg font-black text-slate-900"><CountUp end={score} /></span>
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
          <div className="space-y-6 animate-fade-in animate-slide-up">
            {enrichmentStatus === 'FAILED' ? (
              <div className="bg-rose-50 p-12 border border-rose-100 rounded-xl text-center flex flex-col items-center">
                <div className="p-3 bg-white text-rose-500 rounded-full mb-3 shadow-sm border border-rose-100">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-rose-800">Enrichment Pipeline Failed</h3>
                
                {contact.professionalProfile?.providerResponses && Array.isArray(contact.professionalProfile.providerResponses) && contact.professionalProfile.providerResponses.length > 0 ? (
                  <div className="mt-4 p-4 bg-white border border-rose-200 rounded-lg text-left inline-block">
                    <p className="text-xs font-bold text-rose-900 mb-1">Provider: <span className="font-semibold text-rose-700">{contact.professionalProfile.providerResponses[0].provider}</span></p>
                    <p className="text-xs font-bold text-rose-900">Reason: <br/><span className="font-semibold text-rose-700 mt-0.5 block">{contact.professionalProfile.providerResponses[0].message}</span></p>
                  </div>
                ) : (
                  <p className="text-xs text-rose-600 mt-1.5 max-w-sm leading-relaxed font-semibold">
                    {verificationStatus || 'An unknown error occurred during profile discovery.'}
                  </p>
                )}
              </div>
            ) : Object.keys(groupedCandidates).length === 0 ? (
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
              Object.entries(groupedCandidates).map(([platform, responses]) => {
                const isExpanded = expandedPlatforms[platform] || false;
                const visibleResponses = isExpanded ? responses : responses.slice(0, 1);
                const hiddenCount = responses.length - 1;

                return (
                <div key={platform} className="space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest border-b border-slate-50 pb-1.5 flex items-center gap-2">
                    <span>•</span> {platform} Profiles ({responses.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {responses.length > 0 ? (
                      visibleResponses.map((resp: any, idx: number) => {
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
                                  ${cand.verificationStatus === 'VERIFIED' || cand.verificationStatus === 'Verified'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : cand.verificationStatus?.startsWith('Likely Match')
                                      ? 'bg-amber-50 text-amber-700 border-amber-100'
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
                              {cand.location && (
                                <p className="text-[10px] text-slate-400 font-medium mt-1">
                                  <MapPin className="h-2.5 w-2.5 inline mr-1" /> {cand.location}
                                </p>
                              )}

                              {cand.explainability && (
                                <div className="mt-4 space-y-2.5 border-t border-slate-100/60 pt-3">
                                  {cand.explainability.matchedSignals?.length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                        <Check className="h-2.5 w-2.5 text-emerald-500" /> Matched Signals
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {cand.explainability.matchedSignals.map((sig: string, i: number) => (
                                          <span key={i} className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 font-bold">
                                            {sig}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {cand.explainability.missingSignals?.length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 mt-2.5 flex items-center gap-1">
                                        <AlertTriangle className="h-2.5 w-2.5 text-amber-500" /> Missing Signals
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {cand.explainability.missingSignals.map((sig: string, i: number) => (
                                          <span key={i} className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-bold">
                                            {sig}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {cand.explainability.penalties?.length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 mt-2.5 flex items-center gap-1">
                                        <X className="h-2.5 w-2.5 text-rose-500" /> Penalties Applied
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {cand.explainability.penalties.map((sig: string, i: number) => (
                                          <span key={i} className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100 font-bold">
                                            {sig}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
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
                      })
                    ) : (
                      <div className="md:col-span-2 bg-slate-50/50 py-8 px-4 border border-slate-150 border-dashed rounded-xl text-center flex flex-col items-center justify-center">
                        <p className="text-xs text-slate-400 italic">No verified matching profiles discovered on {platform}.</p>
                      </div>
                    )}
                  </div>
                  
                  {hiddenCount > 0 && (
                    <div className="flex justify-center mt-3">
                      <button
                        onClick={() => setExpandedPlatforms(prev => ({ ...prev, [platform]: !isExpanded }))}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-1.5 rounded-full transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <>Show Less <ChevronUp className="h-3 w-3" /></>
                        ) : (
                          <>View {hiddenCount} More Possible Matches <ChevronDown className="h-3 w-3" /></>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        )}

        {/* ACTIVITY & NOTES TAB */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in animate-slide-up">
            
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
              
              {/* Explainability Section */}
              {selectedCandidate.explainability && (
                <div className="space-y-3 bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl">
                  <h4 className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Why this profile was selected
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Positive Signals */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 mb-2">
                        <Check className="h-3 w-3 text-emerald-600" /> Matched Signals
                      </p>
                      <ul className="space-y-1">
                        {selectedCandidate.explainability.matchedSignals?.map((sig: string, i: number) => (
                          <li key={i} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">
                            {sig}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      {/* Missing Signals */}
                      {selectedCandidate.explainability.missingSignals?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1 mb-2">
                            <AlertTriangle className="h-3 w-3 text-amber-600" /> Missing Signals
                          </p>
                          <ul className="space-y-1">
                            {selectedCandidate.explainability.missingSignals.map((sig: string, i: number) => (
                              <li key={i} className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded">
                                {sig}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Penalties */}
                      {selectedCandidate.explainability.penalties?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-rose-800 flex items-center gap-1 mb-2">
                            <X className="h-3 w-3 text-rose-600" /> Penalties
                          </p>
                          <ul className="space-y-1">
                            {selectedCandidate.explainability.penalties.map((sig: string, i: number) => (
                              <li key={i} className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded">
                                {sig}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* About candidate biography */}
              {(selectedCandidate.summary || selectedCandidate.companyBio) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Structured Biography</h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold bg-slate-50 p-4 border border-slate-100 rounded-xl whitespace-pre-line" style={{ whiteSpace: 'pre-line' }}>
                      {formatGroundedBio(selectedCandidate.summary || selectedCandidate.companyBio, selectedCandidate.experience, selectedCandidate.education, selectedCandidate.designation || selectedCandidate.headline || selectedCandidate.companyRole, selectedCandidate.company)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Raw Biography Text</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                      {selectedCandidate.summary || selectedCandidate.companyBio}
                    </p>
                  </div>
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
