import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadCard, useCardDetails, useDeleteCard } from '../../../hooks/useScanner';
import { useUpdateContact, useCreateContact, useTriggerEnrichment } from '../../../hooks/useContacts';
import { useToastStore } from '../../../store/useToastStore';
import { Button } from '../../../components/Button';
import {
  Upload,
  Camera,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Trash2,
  Edit2,
  Check,
  X,
  Image as ImageIcon,
} from 'lucide-react';

export const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // Workflow states: 'select' | 'processing' | 'review' | 'error'
  const [step, setStep] = useState<'select' | 'processing' | 'review' | 'error'>('select');
  
  // Front and Back Side file states
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');

  const [cardId, setCardId] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<
    'uploading' | 'ocr' | 'ai' | 'verification' | 'search' | 'discovery' | 'completed'
  >('uploading');

  // Drag and drop states
  const [isDragOverFront, setIsDragOverFront] = useState(false);
  const [isDragOverBack, setIsDragOverBack] = useState(false);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
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
  });

  // Inline editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Scanner mutations & queries
  const uploadMutation = useUploadCard();
  const deleteMutation = useDeleteCard();
  const updateContactMutation = useUpdateContact();
  const createContactMutation = useCreateContact();
  const triggerEnrichmentMutation = useTriggerEnrichment();

  // Poll only during OCR processing
  const isPolling = step === 'processing';
  const { data: card } = useCardDetails(cardId, isPolling);

  // Monitor OCR Status
  useEffect(() => {
    if (card) {
      if (card.ocrStatus === 'PROCESSING') {
        setProcessingStatus('ocr');
      } else if (card.ocrStatus === 'COMPLETED') {
        setProcessingStatus('completed');
        
        // Only initialize form fields if we are transitioning to the review step
        if (step !== 'review') {
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
          });

          // Delay slightly for a smoother transition experience
          setTimeout(() => {
            setStep('review');
          }, 800);
        }
      } else if (card.ocrStatus === 'FAILED') {
        setStep('error');
      }
    }
  }, [card, step]);

  // Clean local URL previews on unmount
  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (backPreview) URL.revokeObjectURL(backPreview);
    };
  }, [frontPreview, backPreview]);

  // File validation
  const validateFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      addToast('Invalid file format. Please upload JPEG or PNG.', 'warning');
      return false;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      addToast('File too large. Maximum size is 10MB.', 'warning');
      return false;
    }
    return true;
  };

  const handleFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setFrontFile(file);
        setFrontPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setBackFile(file);
        setBackPreview(URL.createObjectURL(file));
      }
    }
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setFrontFile(file);
        setFrontPreview(URL.createObjectURL(file));
      }
    }
  };

  // Perform upload request
  const handleUpload = async () => {
    if (!frontFile) {
      addToast('Front side image is required.', 'warning');
      return;
    }

    setStep('processing');
    setProcessingStatus('uploading');

    try {
      // 1. Upload front side card
      const response = await uploadMutation.mutateAsync({ file: frontFile });
      setCardId(response.id);
      setProcessingStatus('ocr');
      addToast('Front side uploaded. Starting text extraction...', 'info');
    } catch (err: any) {
      addToast(err.message || 'File upload failed.', 'error');
      setStep('error');
    }
  };

  // Save inline edited value
  const handleSaveField = (fieldName: string) => {
    setFormFields({
      ...formFields,
      [fieldName]: editValue.trim(),
    });
    setEditingField(null);
  };

  // Save reviewed fields and trigger enrichment
  const handleSaveReview = async () => {
    if (!formFields.name.trim()) {
      addToast('Name is required to save.', 'warning');
      return;
    }

    try {
      const contactPayload = {
        name: formFields.name,
        company: formFields.company || undefined,
        designation: formFields.designation || undefined,
        email: formFields.email || undefined,
        phone: formFields.phone || undefined,
        website: formFields.website || undefined,
        address: formFields.address || undefined,
        linkedInUrl: formFields.linkedInUrl || undefined,
      };

      let finalContactId = card?.contactId;

      if (finalContactId) {
        try {
          // Attempt to update existing contact
          await updateContactMutation.mutateAsync({
            id: finalContactId,
            data: contactPayload as any,
          });
          addToast('Contact updated successfully.', 'success');
        } catch (updateErr) {
          // Fallback if contact was deleted or not found: create a new one!
          const newContact = await createContactMutation.mutateAsync({
            ...contactPayload,
            source: 'BUSINESS_CARD',
          } as any);
          finalContactId = newContact.id;
          addToast('Created new contact profile successfully.', 'success');
        }
      } else {
        // Create new contact
        const newContact = await createContactMutation.mutateAsync({
          ...contactPayload,
          source: 'BUSINESS_CARD',
        } as any);
        finalContactId = newContact.id;
        addToast('Contact created successfully.', 'success');
      }

      // If back side image exists, upload it and link to contact ID
      if (backFile && finalContactId) {
        try {
          await uploadMutation.mutateAsync({ file: backFile, contactId: finalContactId });
          addToast('Back side card image linked.', 'success');
        } catch (backErr) {
          console.warn('Failed to upload back side card image:', backErr);
        }
      }

      // Trigger profile enrichment workflow immediately
      if (finalContactId) {
        try {
          await triggerEnrichmentMutation.mutateAsync(finalContactId);
          addToast('Profile enrichment initiated.', 'info');
        } catch (enrichErr: any) {
          addToast('Failed to start profile enrichment.', 'error');
        }
      }

      navigate(`/contacts/${finalContactId}`);
    } catch (err: any) {
      addToast(err.message || 'Failed to save contact details.', 'error');
    }
  };

  const handleReset = () => {
    setFrontFile(null);
    setBackFile(null);
    setFrontPreview('');
    setBackPreview('');
    setCardId('');
    setStep('select');
  };

  const handleDeleteCard = async () => {
    if (!cardId) {
      handleReset();
      return;
    }
    try {
      await deleteMutation.mutateAsync(cardId);
      addToast('Scan discarded successfully.', 'info');
      handleReset();
    } catch (err: any) {
      addToast(err.message || 'Failed to discard scan.', 'error');
      handleReset();
    }
  };

  const getUnderstanding = (fieldName: string) => {
    const extractedData = card?.extractedData as any;
    if (!extractedData?.understanding) return null;
    return extractedData.understanding.find((u: any) => 
      u.field.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase()
    );
  };

  const renderConfidenceBadge = (fieldName: string) => {
    const u = getUnderstanding(fieldName);
    if (!u) return null;

    let badgeClass = '';
    let label = '';
    if (u.confidence >= 0.8) {
      badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      label = `High (${(u.confidence * 100).toFixed(0)}%)`;
    } else if (u.confidence >= 0.6) {
      badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
      label = `Med (${(u.confidence * 100).toFixed(0)}%)`;
    } else {
      badgeClass = 'bg-rose-50 text-rose-700 border border-rose-200';
      label = `Low (${(u.confidence * 100).toFixed(0)}%)`;
    }

    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full select-none ${badgeClass}`} title={u.reasoning}>
        {label}
      </span>
    );
  };

  // Compute full static url for uploaded image
  const serverBase = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
  const imageUrl = card?.uploadedFile?.url ? `${serverBase}${card.uploadedFile.url}` : frontPreview;

  // Timeline steps
  const timelineSteps = [
    { key: 'uploading', label: 'Uploading files' },
    { key: 'ocr', label: 'OCR Processing' },
    { key: 'ai', label: 'AI Extraction' },
    { key: 'verification', label: 'Verification Engine' },
    { key: 'search', label: 'Search Intelligence' },
    { key: 'discovery', label: 'Profile Discovery' },
    { key: 'completed', label: 'Completed' },
  ];

  const getTimelineStepStatus = (stepKey: string) => {
    const order = ['uploading', 'ocr', 'ai', 'verification', 'search', 'discovery', 'completed'];
    const currentIdx = order.indexOf(processingStatus);
    const targetIdx = order.indexOf(stepKey);

    if (targetIdx < currentIdx || processingStatus === 'completed') return 'completed';
    if (targetIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Business Card Scanner</h1>
          <p className="text-xs text-slate-400 mt-1">
            Guided workflow to ingest physical credentials and discover online profiles.
          </p>
        </div>
        {step !== 'select' && (
          <Button onClick={handleDeleteCard} variant="outline" className="text-xs text-slate-500 hover:text-rose-600 hover:border-rose-200">
            Cancel Scan
          </Button>
        )}
      </div>

      {/* STEP 1: Select Files Layout */}
      {step === 'select' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Front Side (Required) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Front Side <span className="text-rose-500">*</span>
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOverFront(true); }}
                onDragLeave={() => setIsDragOverFront(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOverFront(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const file = e.dataTransfer.files[0];
                    if (validateFile(file)) {
                      setFrontFile(file);
                      setFrontPreview(URL.createObjectURL(file));
                    }
                  }
                }}
                onClick={() => frontInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[220px] cursor-pointer transition-all duration-205 relative overflow-hidden bg-white
                  ${frontPreview ? 'border-indigo-500 bg-indigo-50/5' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/20'}
                  ${isDragOverFront ? 'border-indigo-500 bg-indigo-50/10' : ''}`}
              >
                <input
                  type="file"
                  ref={frontInputRef}
                  onChange={handleFrontChange}
                  accept="image/jpeg, image/png"
                  className="hidden"
                />
                {frontPreview ? (
                  <>
                    <img src={frontPreview} alt="Front Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1.5">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-xs font-bold">Replace Front Image</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-indigo-500 mb-3" />
                    <p className="text-xs font-bold text-slate-800">Drag & drop FRONT image here</p>
                    <p className="text-[10px] text-slate-400 mt-1">or click to browse local files (JPEG, PNG)</p>
                  </>
                )}
              </div>
            </div>

            {/* Back Side (Optional) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Back Side (Optional)
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOverBack(true); }}
                onDragLeave={() => setIsDragOverBack(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOverBack(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const file = e.dataTransfer.files[0];
                    if (validateFile(file)) {
                      setBackFile(file);
                      setBackPreview(URL.createObjectURL(file));
                    }
                  }
                }}
                onClick={() => backInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[220px] cursor-pointer transition-all duration-205 relative overflow-hidden bg-white
                  ${backPreview ? 'border-indigo-500 bg-indigo-50/5' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/20'}
                  ${isDragOverBack ? 'border-indigo-500 bg-indigo-50/10' : ''}`}
              >
                <input
                  type="file"
                  ref={backInputRef}
                  onChange={handleBackChange}
                  accept="image/jpeg, image/png"
                  className="hidden"
                />
                {backPreview ? (
                  <>
                    <img src={backPreview} alt="Back Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1.5">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-xs font-bold">Replace Back Image</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-slate-400 mb-3" />
                    <p className="text-xs font-bold text-slate-800">Drag & drop BACK image here</p>
                    <p className="text-[10px] text-slate-400 mt-1">or click to browse local files (Optional)</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Capture Options */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl gap-4">
            <div className="text-center sm:text-left">
              <h3 className="text-xs font-bold text-slate-800">Camera Snapping Mode</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Use your mobile device's camera to scan cards directly.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={triggerCamera} variant="outline" className="flex items-center gap-1.5 text-xs bg-white py-2 px-4 border-slate-200">
                <Camera className="h-3.5 w-3.5" /> Camera Capture
              </Button>
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleCameraChange}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
            </div>
          </div>

          {frontFile && (
            <div className="flex justify-end mt-4">
              <Button onClick={handleUpload} className="w-full sm:w-auto py-2.5 px-6 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10">
                Upload & Process OCR <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Processing state and progress timeline */}
      {step === 'processing' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-10 shadow-lg min-h-[380px] w-full animate-slide-down">
          <div className="flex-1 text-center md:text-left flex flex-col items-center md:items-start">
            <span className="text-[9px] font-black tracking-widest text-indigo-500 uppercase">Guided Ingestion Pipeline</span>
            <h2 className="text-2xl font-black text-slate-800 mt-2">Processing Business Card</h2>
            <p className="text-xs text-slate-400 mt-3 max-w-sm leading-relaxed">
              We are parsing your business card details with specialized OCR. Follow the pipeline steps to complete extraction.
            </p>
            <div className="mt-8 flex gap-3">
              <Button onClick={handleDeleteCard} variant="outline" className="text-xs py-2 px-4 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">
                Cancel OCR Ingestion
              </Button>
            </div>
          </div>

          <div className="w-full md:w-96 flex flex-col gap-4 border-l border-slate-100 pl-0 md:pl-8 py-2">
            {timelineSteps.map((s, idx) => {
              const status = getTimelineStepStatus(s.key);
              return (
                <div key={idx} className="flex items-center gap-4">
                  {status === 'completed' && (
                    <div className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                      ✓
                    </div>
                  )}
                  {status === 'active' && (
                    <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                      <div className="h-2 w-2 bg-indigo-600 rounded-full animate-ping" />
                    </div>
                  )}
                  {status === 'pending' && (
                    <div className="h-6 w-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-350 text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </div>
                  )}
                  <span className={`text-xs font-bold ${status === 'active' ? 'text-indigo-600' : (status === 'completed' ? 'text-emerald-700 font-semibold' : 'text-slate-400')}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: Review Panel (Inline Editable Cards) */}
      {step === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-slide-down">
          {/* Left panel: Image preview card */}
          <div className="lg:col-span-5 bg-white p-4 border border-slate-100 rounded-xl shadow-xs flex flex-col gap-4">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center justify-between border-b border-slate-50 pb-2">
              Business Card Images
              <button
                onClick={handleDeleteCard}
                className="text-slate-400 hover:text-rose-600 transition-colors outline-none"
                title="Discard scan"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </h2>

            {/* Adjust layout: side-by-side if back image available, otherwise full width */}
            <div className={`grid gap-4 ${backPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="flex flex-col gap-1.5 text-center">
                <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center aspect-video max-h-[180px]">
                  <img src={imageUrl} alt="Front card" className="max-h-full max-w-full object-contain" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Front Side</span>
              </div>
              
              {backPreview && (
                <div className="flex flex-col gap-1.5 text-center">
                  <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center aspect-video max-h-[180px]">
                    <img src={backPreview} alt="Back card" className="max-h-full max-w-full object-contain" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Back Side</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-start gap-2.5 mt-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-indigo-800">OCR Ingestion Complete</h3>
                <p className="text-[10px] text-indigo-700/90 leading-relaxed mt-1">
                  Correct any fields inline before confirming saving to your contact database and triggering AI enrichment.
                </p>
              </div>
            </div>
          </div>

          {/* Right panel: Clean Information Review Panel */}
          <div className="lg:col-span-7 bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                Basic Information Review
              </h2>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Click any pencil icon to edit inline
              </span>
            </div>

            <div className="space-y-4">
              {/* Field mapping list */}
              {[
                { key: 'name', label: 'Name', required: true },
                { key: 'company', label: 'Company' },
                { key: 'designation', label: 'Designation' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'website', label: 'Website' },
                { key: 'address', label: 'Address' },
                { key: 'linkedInUrl', label: 'LinkedIn URL' },
              ].map((f) => {
                const isEditing = editingField === f.key;
                const value = (formFields as any)[f.key];

                return (
                  <div key={f.key} className="border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                      </label>
                      {renderConfidenceBadge(f.key === 'linkedInUrl' ? 'linkedin_url' : f.key)}
                    </div>

                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveField(f.key);
                        }}
                        className="flex items-center gap-2 mt-1"
                      >
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-indigo-500 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                        />
                        <button
                          type="submit"
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingField(null)}
                          className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between min-h-[28px] mt-1 group">
                        <span className={`text-xs font-semibold ${value ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                          {value || `No ${f.label.toLowerCase()} extracted`}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingField(f.key);
                            setEditValue(value);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Confirm Save Actions */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={handleDeleteCard}
                variant="outline"
                className="flex-1 py-2 text-xs border-slate-200"
              >
                Discard
              </Button>
              <Button
                type="button"
                onClick={handleSaveReview}
                isLoading={updateContactMutation.isPending || createContactMutation.isPending}
                disabled={!formFields.name.trim()}
                className="flex-1 py-2 text-xs font-bold"
              >
                Confirm & Save Contact
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Ingestion failure state */}
      {step === 'error' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Card Ingestion Failed</h2>
          <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
            The OCR parser encountered a pipeline error. Please ensure the card image contains visible and readable credentials.
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={handleReset} variant="outline" className="text-xs py-1.5 px-4 border-slate-200">
              Clear & Go Back
            </Button>
            <Button onClick={handleUpload} className="flex items-center gap-1.5 text-xs py-1.5 px-4">
              <RefreshCw className="h-3.5 w-3.5" /> Retry Ingestion
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
