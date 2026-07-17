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
  Cpu,
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
        const fields = card.extractedData?.fields || {};
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
      {step === 'processing' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[350px]">
          <div className="relative mb-6">
            <div className="h-16 w-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <Cpu className="absolute inset-0 m-auto h-6 w-6 text-indigo-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">OCR Engine Active</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Parsing text fields, verifying hashes, and checking embedded vCard QR codes. This takes roughly 5-10 seconds...
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={handleDeleteCard} variant="outline" className="text-xs py-1.5 px-3 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">
              Cancel & Delete
            </Button>
          </div>
        </div>
      )}

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
              {/* Field: Name */}
              <div>
                <Input
                  label="Name (Required)"
                  type="text"
                  value={formFields.name}
                  onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
                  error={!formFields.name ? 'Name is required' : undefined}
                />
              </div>

              {/* Field: Company */}
              <div className="relative">
                <Input
                  label="Company"
                  type="text"
                  value={formFields.company}
                  onChange={(e) => setFormFields({ ...formFields, company: e.target.value })}
                />
                {!formFields.company && (
                  <span className="absolute right-3 top-9 flex items-center gap-1 text-[9px] font-extrabold text-amber-600/85">
                    <AlertTriangle className="h-3 w-3 shrink-0" /> Check
                  </span>
                )}
              </div>

              {/* Field: Designation */}
              <div className="relative">
                <Input
                  label="Designation / Title"
                  type="text"
                  value={formFields.designation}
                  onChange={(e) => setFormFields({ ...formFields, designation: e.target.value })}
                />
                {!formFields.designation && (
                  <span className="absolute right-3 top-9 flex items-center gap-1 text-[9px] font-extrabold text-amber-600/85">
                    <AlertTriangle className="h-3 w-3 shrink-0" /> Check
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Field: Email */}
                <div className="relative">
                  <Input
                    label="Email"
                    type="email"
                    value={formFields.email}
                    onChange={(e) => setFormFields({ ...formFields, email: e.target.value })}
                  />
                  {!formFields.email && (
                    <span className="absolute right-3 top-9 flex items-center gap-1 text-[9px] font-extrabold text-amber-600/85">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> Check
                    </span>
                  )}
                </div>

                {/* Field: Phone */}
                <div className="relative">
                  <Input
                    label="Phone"
                    type="text"
                    value={formFields.phone}
                    onChange={(e) => setFormFields({ ...formFields, phone: e.target.value })}
                  />
                  {!formFields.phone && (
                    <span className="absolute right-3 top-9 flex items-center gap-1 text-[9px] font-extrabold text-amber-600/85">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> Check
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Field: Website */}
                <div>
                  <Input
                    label="Website"
                    type="text"
                    value={formFields.website}
                    onChange={(e) => setFormFields({ ...formFields, website: e.target.value })}
                  />
                </div>

                {/* Field: LinkedIn URL */}
                <div>
                  <Input
                    label="LinkedIn Profile URL"
                    type="text"
                    value={formFields.linkedInUrl}
                    onChange={(e) => setFormFields({ ...formFields, linkedInUrl: e.target.value })}
                  />
                </div>
              </div>

              {/* Field: Address */}
              <div>
                <Input
                  label="Address"
                  type="text"
                  value={formFields.address}
                  onChange={(e) => setFormFields({ ...formFields, address: e.target.value })}
                />
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
