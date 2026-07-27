import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReadQrCode, useParseQrText } from '../../../hooks/useIngestion';
import { useCreateContact } from '../../../hooks/useContacts';
import { useToastStore } from '../../../store/useToastStore';
import { Loader } from '../../../components/Loader';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import {
  Camera,
  FileImage,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export const QrScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // Workflow states: 'select' | 'camera' | 'decoding' | 'review' | 'error'
  const [step, setStep] = useState<'select' | 'camera' | 'decoding' | 'review' | 'error'>('select');
  const [progressMessage, setProgressMessage] = useState('Reading QR Code...');
  const [localPreview, setLocalPreview] = useState<string>('');
  
  // Drag and drop states
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Queries & Mutations hooks
  const readQrMutation = useReadQrCode();
  const parseQrTextMutation = useParseQrText();
  const createContactMutation = useCreateContact();

  useEffect(() => {
    if (step === 'camera') {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText) => {
          scanner.clear();
          performLiveDecode(decodedText);
        },
        (_error) => {
          // ignore scan errors, they happen every frame a QR is not found
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    } else if (step === 'decoding') {
      setProgressMessage('Reading QR Code...');
      const timer1 = setTimeout(() => setProgressMessage('Running OCR Extraction...'), 1500);
      const timer2 = setTimeout(() => setProgressMessage('Merging and Validating Results...'), 4000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [step]);

  const startCamera = () => {
    setStep('camera');
  };

  const stopCamera = () => {
    // handled by Html5QrcodeScanner cleanup
  };

  const performLiveDecode = async (decodedText: string) => {
    setStep('decoding');
    try {
      const response = await parseQrTextMutation.mutateAsync(decodedText);
      const fields = response.parsedFields || {};
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
      addToast('Live QR Code successfully parsed.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Live QR code decoding failed.', 'error');
      setStep('error');
    }
  };

  // Perform decode upload request
  const performDecode = async (file: File) => {
    setStep('decoding');
    try {
      const response = await readQrMutation.mutateAsync(file);
      const fields = response.parsedFields || {};
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
      addToast('QR Code successfully parsed.', 'success');
    } catch (err: any) {
      addToast(err.message || 'QR code decoding failed.', 'error');
      setStep('error');
    }
  };

  // File drag & drop validators
  const validateAndSetFile = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      addToast('Invalid file format. Upload JPEG or PNG.', 'warning');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      addToast('File too large. Maximum size is 10MB.', 'warning');
      return;
    }

    setLocalPreview(URL.createObjectURL(file));
    await performDecode(file);
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

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await createContactMutation.mutateAsync({
        name: formFields.name,
        company: formFields.company || undefined,
        designation: formFields.designation || undefined,
        email: formFields.email || undefined,
        phone: formFields.phone || undefined,
        website: formFields.website || undefined,
        address: formFields.address || undefined,
        linkedInUrl: formFields.linkedInUrl || undefined,
        source: 'QR',
        skills: [],
        tags: ['QR Import'],
      } as any);

      addToast('Contact imported successfully.', 'success');
      navigate(`/contacts/${response.id}`);
    } catch (err: any) {
      addToast(err.message || 'Failed to save contact.', 'error');
    }
  };

  const handleReset = () => {
    setLocalPreview('');
    stopCamera();
    setStep('select');
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">QR Ingestion</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
          Ingest vCard MeCard contact payloads via QR codes
        </p>
      </div>

      {/* STEP 1: Selection portal */}
      {step === 'select' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ingestion Dropzone */}
          <div className="md:col-span-2 flex flex-col gap-4">
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
              <QrCode className="h-10 w-10 text-indigo-500 mb-4 animate-pulse" />
              <p className="text-sm font-bold text-slate-800">Drag & drop QR image here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse local files (JPEG, PNG up to 10MB)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={startCamera} variant="outline" className="flex items-center justify-center gap-2 py-3 bg-white">
                <Camera className="h-4 w-4" /> Start Camera
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex items-center justify-center gap-2 py-3 bg-white">
                <FileImage className="h-4 w-4" /> Import Gallery Image
              </Button>
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-3">
              Guidelines
            </h2>
            <ul className="text-xs text-slate-500 space-y-2 leading-relaxed font-semibold">
              <li>• Works with raw vCard strings or MeCard formats.</li>
              <li>• Upload clean, high-resolution snapshots to prevent decode failures.</li>
              <li>• Verify parsed fields before saving to the database.</li>
            </ul>
          </div>
        </div>
      )}

      {/* STEP 2: Live Camera Viewfinder */}
      {step === 'camera' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center min-h-[400px]">
          <div id="qr-reader" className="w-full max-w-lg overflow-hidden rounded-xl border-2 border-indigo-100"></div>
          <div className="mt-6 flex justify-center w-full">
            <Button onClick={handleReset} variant="outline" className="w-full max-w-xs text-xs">
              Cancel Camera Scan
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Decoding status */}
      {step === 'decoding' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <Loader message={progressMessage} size="lg" />
        </div>
      )}

      {/* STEP 4: Review fields before creating */}
      {step === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-slide-down">
          {/* Left panel Preview info */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
              <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-3 flex items-center justify-between">
                Decoded Source Image
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-rose-600 transition-all font-bold outline-none"
                >
                  Discard
                </button>
              </h2>
              <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center max-h-[220px] aspect-video">
                <img src={localPreview} alt="QR card Source" className="max-h-full max-w-full object-contain" />
              </div>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800">
              <h3 className="text-xs font-bold flex items-center gap-1.5 leading-none">
                <ShieldCheck className="h-4 w-4" /> QR Payload Verified
              </h3>
              <p className="text-[11px] text-indigo-700/80 leading-relaxed mt-1.5">
                Check and align values before committing to the database.
              </p>
            </div>
          </div>

          {/* Right panel editable review forms */}
          <div className="lg:col-span-2 bg-white p-6 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4">
              Parsed Contact Details
            </h2>
            <form onSubmit={handleSaveContact} className="space-y-4">
              <Input
                label="Name (Required)"
                type="text"
                value={formFields.name}
                onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
                error={!formFields.name ? 'Name is required' : undefined}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Company"
                  type="text"
                  value={formFields.company}
                  onChange={(e) => setFormFields({ ...formFields, company: e.target.value })}
                />
                <Input
                  label="Designation"
                  type="text"
                  value={formFields.designation}
                  onChange={(e) => setFormFields({ ...formFields, designation: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  value={formFields.email}
                  onChange={(e) => setFormFields({ ...formFields, email: e.target.value })}
                />
                <Input
                  label="Phone"
                  type="text"
                  value={formFields.phone}
                  onChange={(e) => setFormFields({ ...formFields, phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Website"
                  type="text"
                  value={formFields.website}
                  onChange={(e) => setFormFields({ ...formFields, website: e.target.value })}
                />
                <Input
                  label="LinkedIn Profile URL"
                  type="text"
                  value={formFields.linkedInUrl}
                  onChange={(e) => setFormFields({ ...formFields, linkedInUrl: e.target.value })}
                />
              </div>

              <Input
                label="Address"
                type="text"
                value={formFields.address}
                onChange={(e) => setFormFields({ ...formFields, address: e.target.value })}
              />

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <Button type="button" onClick={handleReset} variant="outline" className="flex-1 py-2 text-xs">
                  Discard Ingestion
                </Button>
                <Button
                  type="submit"
                  isLoading={createContactMutation.isPending}
                  disabled={!formFields.name}
                  className="flex-1 py-2 text-xs font-bold"
                >
                  Confirm & Save Ingestion
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 5: Error fallback status */}
      {step === 'error' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">QR Decoding Failed</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            Could not parse valid vCard or contact text records from the QR image. Make sure the QR image contains correct payloads and has good clarity.
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={handleReset} variant="outline" className="text-xs py-1.5 px-3">
              Clear & Go Back
            </Button>
            <Button onClick={startCamera} className="flex items-center gap-1.5 text-xs py-1.5 px-4">
              <RefreshCw className="h-3.5 w-3.5" /> Try Scanning Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
