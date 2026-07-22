import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadCard, useCardDetails, useDeleteCard } from '../../../hooks/useScanner';
import { useUpdateContact } from '../../../hooks/useContacts';
import { useToastStore } from '../../../store/useToastStore';
import { Loader } from '../../../components/Loader';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import {
  Upload,
  Camera,
  FileImage,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

export const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // Workflow states: 'select' | 'uploading' | 'processing' | 'review' | 'error'
  const [step, setStep] = useState<'select' | 'uploading' | 'processing' | 'review' | 'error'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string>('');
  const [cardId, setCardId] = useState<string>('');

  // Drag and drop states
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Review Form local states
  const [formFields, setFormFields] = useState({
    name: '',
    company: '',
    designation: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    linkedInUrl: '',
    department: '',
    industry: '',
    postalCode: '',
    skills: '',
    professionalSummary: '',
    experience: [] as any[],
    education: [] as any[],
  });

  // Scanner mutations & queries
  const uploadMutation = useUploadCard();
  const deleteMutation = useDeleteCard();
  const updateContactMutation = useUpdateContact();

  // Poll only during pending / processing
  const isPolling = step === 'processing';
  const { data: card } = useCardDetails(cardId, isPolling);

  // Handle polling state changes
  useEffect(() => {
    if (card) {
      if (card.ocrStatus === 'COMPLETED') {
        // Pre-fill review form with parsed OCR fields
        const fields = (card.extractedData?.fields || {}) as any;
        setFormFields({
          name: fields.name || '',
          company: fields.company || '',
          designation: fields.designation || '',
          email: fields.email || '',
          phone: fields.phone || '',
          website: fields.website || '',
          address: fields.address || '',
          linkedInUrl: fields.linkedin_url || '',
          department: fields.department || '',
          industry: fields.industry || '',
          postalCode: fields.postalCode || '',
          skills: Array.isArray(fields.skills) ? fields.skills.join(', ') : (fields.skills || ''),
          professionalSummary: fields.professionalSummary || '',
          experience: fields.experience || [],
          education: fields.education || [],
        });
        setStep('review');
      } else if (card.ocrStatus === 'FAILED') {
        setStep('error');
      }
    }
  }, [card]);

  // Clean local URL previews
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  // Handle file selection & validation
  const validateAndSetFile = (file: File) => {
    // Check type: JPEG or PNG
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      addToast('Invalid file format. Please upload JPEG or PNG.', 'warning');
      return;
    }

    // Check size: max 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      addToast('File too large. Maximum size is 10MB.', 'warning');
      return;
    }

    setSelectedFile(file);
    setLocalPreview(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Perform upload request
  const handleUpload = async () => {
    if (!selectedFile) return;
    setStep('uploading');
    try {
      const response = await uploadMutation.mutateAsync({ file: selectedFile });
      setCardId(response.id);
      setStep('processing');
      addToast('Image uploaded. Extracting text details...', 'info');
    } catch (err: any) {
      addToast(err.message || 'File upload failed.', 'error');
      setStep('error');
    }
  };

  // Save reviewed fields
  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card?.contactId) {
      addToast('No linked contact found to update.', 'error');
      return;
    }

    try {
      // Map form fields to API format (and map linkedinUrl to profile)
      const contactPayload = {
        name: formFields.name,
        company: formFields.company || null,
        designation: formFields.designation || null,
        email: formFields.email || null,
        phone: formFields.phone || null,
        website: formFields.website || null,
        address: formFields.address || null,
        linkedInUrl: formFields.linkedInUrl || null,
        department: formFields.department || null,
        industry: formFields.industry || null,
        skills: formFields.skills ? formFields.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        experience: formFields.experience || null,
        education: formFields.education || null,
      };

      await updateContactMutation.mutateAsync({
        id: card.contactId,
        data: contactPayload as any,
      });

      addToast('Contact verified and created successfully.', 'success');
      navigate(`/contacts/${card.contactId}`);
    } catch (err: any) {
      addToast(err.message || 'Failed to update contact.', 'error');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setLocalPreview('');
    setCardId('');
    setStep('select');
  };

  const handleDeleteCard = async () => {
    if (!cardId) return;
    try {
      await deleteMutation.mutateAsync(cardId);
      addToast('Scan cancelled. Uploaded images deleted.', 'info');
      handleReset();
    } catch (err: any) {
      addToast(err.message || 'Failed to cancel scan.', 'error');
    }
  };

  // Compute full static url for uploaded image
  const serverBase = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
  const imageUrl = card?.uploadedFile?.url ? `${serverBase}${card.uploadedFile.url}` : localPreview;
  const isEnhanced = false;

  const getUnderstanding = (fieldName: string) => {
    const extractedData = card?.extractedData as any;
    if (!extractedData?.understanding) return null;
    return extractedData.understanding.find((u: any) => 
      u.field.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase()
    );
  };

  const getFieldClass = (fieldName: keyof typeof formFields) => {
    const u = getUnderstanding(fieldName);
    if (!u) return '';
    if (u.confidence >= 0.8) return 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-100';
    if (u.confidence >= 0.7) return 'border-amber-200 focus:border-amber-500 focus:ring-amber-100';
    return 'border-rose-200 focus:border-rose-500 focus:ring-rose-100';
  };

  const renderVerificationBadge = (fieldName: keyof typeof formFields) => {
    const u = getUnderstanding(fieldName);
    if (!u) return null;

    let badgeClass = '';
    let label = '';
    if (u.confidence >= 0.8) {
      badgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      label = `High (${(u.confidence * 100).toFixed(0)}%)`;
    } else if (u.confidence >= 0.7) {
      badgeClass = 'bg-amber-50 text-amber-600 border border-amber-100';
      label = `Medium (${(u.confidence * 100).toFixed(0)}%)`;
    } else {
      badgeClass = 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse';
      label = `Low (${(u.confidence * 100).toFixed(0)}%)`;
    }

    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${badgeClass}`} title={u.reasoning}>
        {label}
      </span>
    );
  };

  const renderEnhancementMeta = (fieldName: keyof typeof formFields) => {
    const u = getUnderstanding(fieldName);
    if (!u) return null;

    return (
      <p className="text-[10px] text-slate-400 mt-1 pl-1 border-l-2 border-slate-200 ml-1">
        <span className="font-semibold text-slate-500">AI Reasoning:</span> {u.reasoning}
      </p>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Business Card Scanner</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
          Convert physical cards into digital profiles
        </p>
      </div>

      {/* STEP 1: File Selection */}
      {step === 'select' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left panel: Upload options */}
          <div className="md:col-span-2 flex flex-col gap-4">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[260px] cursor-pointer transition-all duration-200
                ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/10'
                    : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/30'
                }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg, image/png"
                className="hidden"
              />
              <Upload className="h-10 w-10 text-indigo-500 mb-4 animate-bounce" />
              <p className="text-sm font-bold text-slate-800">Drag & drop card here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse local files (JPEG, PNG up to 10MB)</p>
            </div>

            {/* Mobile Camera triggers */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => cameraInputRef.current?.click()}
                variant="outline"
                className="flex items-center justify-center gap-2 py-3 bg-white"
              >
                <Camera className="h-4 w-4" /> Snap Photo
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex items-center justify-center gap-2 py-3 bg-white"
              >
                <FileImage className="h-4 w-4" /> Open Gallery
              </Button>
            </div>
          </div>

          {/* Right Panel: Selected file preview */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4">
                Selected File
              </h2>
              {selectedFile ? (
                <div className="flex flex-col gap-3">
                  <div className="border border-slate-100 rounded-xl overflow-hidden aspect-video bg-slate-950 flex items-center justify-center">
                    <img src={localPreview} alt="Card Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                  <FileImage className="h-8 w-8 mb-2" />
                  <p className="text-xs">No image selected</p>
                </div>
              )}
            </div>

            {selectedFile && (
              <Button onClick={handleUpload} className="w-full mt-6 py-2.5 font-bold text-xs flex items-center justify-center gap-1">
                Upload & Process OCR <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Uploading state */}
      {step === 'uploading' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <Loader message="Uploading business card image..." size="lg" />
        </div>
      )}

      {/* STEP 3: Polling OCR processing status */}
      {/* STEP 3: Polling OCR processing status */}
      {step === 'processing' && (() => {
        const ocrStatus = card?.ocrStatus || 'PENDING';
        const profileStatus = card?.contact?.professionalProfile?.enrichmentStatus;

        // Steps mapping
        const isOcrActive = ocrStatus === 'PENDING' || ocrStatus === 'PROCESSING';
        const isOcrDone = ocrStatus === 'COMPLETED';
        
        const isVerifActive = isOcrDone && (!profileStatus || profileStatus === 'PENDING' || profileStatus === 'QUEUED');
        const isVerifDone = isOcrDone && profileStatus && profileStatus !== 'PENDING' && profileStatus !== 'QUEUED';

        const isBuildActive = isOcrDone && profileStatus && ['PROCESSING', 'FETCHING_PROFILE', 'VERIFYING', 'GENERATING_SUMMARY'].includes(profileStatus);
        const isBuildDone = profileStatus === 'COMPLETED';

        const steps = [
          { label: 'Uploading Business Card Image', status: 'completed' },
          { label: 'OCR Engine Parsing & Extraction', status: isOcrDone ? 'completed' : (isOcrActive ? 'active' : 'pending') },
          { label: 'Verification Engine Signal Analysis', status: isVerifDone ? 'completed' : (isVerifActive ? 'active' : 'pending') },
          { label: 'OSINT Search & Profile Enrichment', status: isBuildDone ? 'completed' : (isBuildActive ? 'active' : 'pending') },
          { label: 'Finalizing Contact Summary', status: isBuildDone ? 'completed' : 'pending' }
        ];

        // Trigger automatic redirect when completed
        if (isBuildDone && card?.contact?.id) {
          setTimeout(() => {
            navigate(`/contacts/${card.contact?.id}`);
          }, 1500);
        }

        return (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 flex flex-col md:flex-row items-center gap-10 shadow-lg min-h-[400px] max-w-4xl mx-auto animate-slide-down">
            <div className="flex-1 flex flex-col items-center text-center md:text-left md:items-start">
              <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase">Real-Time Ingestion</span>
              <h2 className="text-2xl font-black text-slate-800 mt-2">Processing Contact</h2>
              <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                We are parsing your business card and performing real-time public searches to construct a comprehensive profile.
              </p>
              
              <div className="mt-8 flex gap-3">
                <Button onClick={handleDeleteCard} variant="outline" className="text-xs py-2 px-4 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">
                  Cancel Processing
                </Button>
              </div>
            </div>

            <div className="w-full md:w-96 flex flex-col gap-5 border-l border-slate-100 pl-0 md:pl-8">
              {steps.map((s, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  {s.status === 'completed' && (
                    <div className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                      ✓
                    </div>
                  )}
                  {s.status === 'active' && (
                    <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                      <div className="h-2.5 w-2.5 bg-indigo-600 rounded-full animate-ping" />
                    </div>
                  )}
                  {s.status === 'pending' && (
                    <div className="h-6 w-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                  )}
                  <span className={`text-xs font-bold ${s.status === 'active' ? 'text-slate-800' : (s.status === 'completed' ? 'text-emerald-700 font-semibold' : 'text-slate-400')}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* STEP 4: Review OCR Output side-by-side */}
      {step === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left panel: High resolution Image preview card */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col gap-4 sticky top-6">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-2 flex items-center justify-between">
              Card Image
              <button
                onClick={handleDeleteCard}
                className="text-slate-400 hover:text-rose-600 transition-colors outline-none"
                title="Discard card"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </h2>
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[320px] aspect-video">
              <img src={imageUrl} alt="Uploaded card" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> OCR Verification Check
              </h3>
              <p className="text-[11px] text-indigo-700/80 leading-relaxed mt-1">
                The scanner has completed. Please align the extracted values below before saving to your profile database.
              </p>
            </div>
          </div>

          {/* Right panel: Correction edit form */}
          <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4">
              Edit Extracted Fields
            </h2>

            <form onSubmit={handleSaveReview} className="space-y-4">
                    <div className="space-y-4">
                      {/* Field: Name */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                            Name (Required)
                          </label>
                          {renderVerificationBadge('name')}
                        </div>
                        <Input
                          type="text"
                          value={formFields.name}
                          onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
                          error={!formFields.name ? 'Name is required' : undefined}
                          className={getFieldClass('name')}
                        />
                        {renderEnhancementMeta('name')}
                      </div>

                      {/* Field: Company */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                            Company
                          </label>
                          {renderVerificationBadge('company')}
                        </div>
                        <Input
                          type="text"
                          value={formFields.company}
                          onChange={(e) => setFormFields({ ...formFields, company: e.target.value })}
                          className={getFieldClass('company')}
                        />
                        {renderEnhancementMeta('company')}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Field: Designation */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              Designation / Title
                            </label>
                            {renderVerificationBadge('designation')}
                          </div>
                          <Input
                            type="text"
                            value={formFields.designation}
                            onChange={(e) => setFormFields({ ...formFields, designation: e.target.value })}
                            className={getFieldClass('designation')}
                          />
                          {renderEnhancementMeta('designation')}
                        </div>

                        {/* Field: Department */}
                        {(formFields.department || isEnhanced) && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                                Department
                              </label>
                              {renderVerificationBadge('department')}
                            </div>
                            <Input
                              type="text"
                              value={formFields.department}
                              onChange={(e) => setFormFields({ ...formFields, department: e.target.value })}
                              className={getFieldClass('department')}
                            />
                            {renderEnhancementMeta('department')}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Field: Email */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              Email
                            </label>
                            {renderVerificationBadge('email')}
                          </div>
                          <Input
                            type="email"
                            value={formFields.email}
                            onChange={(e) => setFormFields({ ...formFields, email: e.target.value })}
                            className={getFieldClass('email')}
                          />
                          {renderEnhancementMeta('email')}
                        </div>

                        {/* Field: Phone */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              Phone
                            </label>
                            {renderVerificationBadge('phone')}
                          </div>
                          <Input
                            type="text"
                            value={formFields.phone}
                            onChange={(e) => setFormFields({ ...formFields, phone: e.target.value })}
                            className={getFieldClass('phone')}
                          />
                          {renderEnhancementMeta('phone')}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Field: Website */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              Website
                            </label>
                            {renderVerificationBadge('website')}
                          </div>
                          <Input
                            type="text"
                            value={formFields.website}
                            onChange={(e) => setFormFields({ ...formFields, website: e.target.value })}
                            className={getFieldClass('website')}
                          />
                          {renderEnhancementMeta('website')}
                        </div>

                        {/* Field: LinkedIn URL */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              LinkedIn Profile URL
                            </label>
                            {renderVerificationBadge('linkedInUrl')}
                          </div>
                          <Input
                            type="text"
                            value={formFields.linkedInUrl}
                            onChange={(e) => setFormFields({ ...formFields, linkedInUrl: e.target.value })}
                            className={getFieldClass('linkedInUrl')}
                          />
                          {renderEnhancementMeta('linkedInUrl')}
                        </div>
                      </div>

                      {/* Field: Address */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              Address
                            </label>
                            {renderVerificationBadge('address')}
                          </div>
                          <Input
                            type="text"
                            value={formFields.address}
                            onChange={(e) => setFormFields({ ...formFields, address: e.target.value })}
                            className={getFieldClass('address')}
                          />
                          {renderEnhancementMeta('address')}
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              Postal Code
                            </label>
                            {renderVerificationBadge('postalCode')}
                          </div>
                          <Input
                            type="text"
                            value={formFields.postalCode}
                            onChange={(e) => setFormFields({ ...formFields, postalCode: e.target.value })}
                            className={getFieldClass('postalCode')}
                          />
                          {renderEnhancementMeta('postalCode')}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Field: Industry */}
                        {(formFields.industry || isEnhanced) && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                                Industry
                              </label>
                              {renderVerificationBadge('industry')}
                            </div>
                            <Input
                              type="text"
                              value={formFields.industry}
                              onChange={(e) => setFormFields({ ...formFields, industry: e.target.value })}
                              className={getFieldClass('industry')}
                            />
                            {renderEnhancementMeta('industry')}
                          </div>
                        )}

                        {/* Field: Skills */}
                        {(formFields.skills || isEnhanced) && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                                Skills (Comma Separated)
                              </label>
                              {renderVerificationBadge('skills')}
                            </div>
                            <Input
                              type="text"
                              value={formFields.skills}
                              onChange={(e) => setFormFields({ ...formFields, skills: e.target.value })}
                              className={getFieldClass('skills')}
                            />
                            {renderEnhancementMeta('skills')}
                          </div>
                        )}
                      </div>

                      {/* Field: Professional Summary */}
                      {(formFields.professionalSummary || isEnhanced) && (
                        <div className="w-full flex flex-col gap-1.5 mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                              Professional Summary
                            </label>
                            {renderVerificationBadge('professionalSummary')}
                          </div>
                          <textarea
                            rows={3}
                            value={formFields.professionalSummary}
                            onChange={(e) => setFormFields({ ...formFields, professionalSummary: e.target.value })}
                            className={`w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none transition-all duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${getFieldClass('professionalSummary')}`}
                          />
                          {renderEnhancementMeta('professionalSummary')}
                        </div>
                      )}

                      {/* Experience Highlights */}
                      {formFields.experience && formFields.experience.length > 0 && (
                        <div className="w-full flex flex-col gap-1.5 mb-4 p-3 bg-slate-50/50 border border-slate-100 rounded-lg">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                              Experience History
                            </label>
                            {renderVerificationBadge('experience')}
                          </div>
                          <div className="space-y-1.5 mt-1">
                            {formFields.experience.map((exp: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                <span className="font-bold text-slate-700">{exp.title}</span> at <span className="font-semibold text-slate-600">{exp.company}</span> <span className="text-slate-400">({exp.period})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Education Highlights */}
                      {formFields.education && formFields.education.length > 0 && (
                        <div className="w-full flex flex-col gap-1.5 mb-4 p-3 bg-slate-50/50 border border-slate-100 rounded-lg">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                              Education
                            </label>
                            {renderVerificationBadge('education')}
                          </div>
                          <div className="space-y-1 mt-1">
                            {formFields.education.map((edu: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                <span className="font-bold text-slate-700">{edu.school}</span> - <span className="text-slate-600">{edu.degree}</span> <span className="text-slate-400">({edu.year})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    onClick={handleDeleteCard}
                    variant="outline"
                    className="flex-1 py-2 text-xs"
                  >
                    Discard
                  </Button>
                  <Button
                    type="submit"
                    isLoading={updateContactMutation.isPending}
                    disabled={!formFields.name}
                    className="flex-1 py-2 text-xs font-bold"
                  >
                    Confirm & Save Contact
                  </Button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 5: Error handling */}
      {step === 'error' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Extraction Failed</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            The OCR worker met with an error during parsing. Verify that the image contains readable text, or check the database configurations.
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={handleReset} variant="outline" className="text-xs py-1.5 px-3">
              Clear & Go Back
            </Button>
            <Button onClick={handleUpload} className="flex items-center gap-1.5 text-xs py-1.5 px-4">
              <RefreshCw className="h-3.5 w-3.5" /> Retry Scan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
