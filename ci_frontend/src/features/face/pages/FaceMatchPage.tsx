import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadFacePhoto, useFaceRecord } from '../../../hooks/useFace';
import { useToastStore } from '../../../store/useToastStore';
import { Loader } from '../../../components/Loader';
import { Button } from '../../../components/Button';
import {
  Upload,
  Camera,
  FileImage,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  UserX,
} from 'lucide-react';

export const FaceMatchPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // Workflow states: 'select' | 'uploading' | 'processing' | 'result' | 'error'
  const [step, setStep] = useState<'select' | 'uploading' | 'processing' | 'result' | 'error'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string>('');
  const [recordId, setRecordId] = useState<string>('');

  // Dropzone references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // biometrics queries & mutations
  const uploadMutation = useUploadFacePhoto();
  const isPolling = step === 'processing';
  const { data: record } = useFaceRecord(recordId, isPolling);

  // Handle polling state changes
  useEffect(() => {
    if (record) {
      if (record.status === 'COMPLETED') {
        setStep('result');
        if (record.recognizedResult?.matched) {
          addToast('Biometric match located.', 'success');
        } else {
          addToast('Biometric processing complete: no match found.', 'info');
        }
      } else if (record.status === 'FAILED') {
        setStep('error');
      }
    }
  }, [record]);

  // Clean local URLs on unmount
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  // Handle file picker selection & validations
  const validateAndSetFile = (file: File) => {
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

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStep('uploading');
    try {
      const response = await uploadMutation.mutateAsync({ file: selectedFile });
      setRecordId(response.id);
      setStep('processing');
      addToast('Biometric photo uploaded. Processing signature...', 'info');
    } catch (err: any) {
      addToast(err.message || 'Biometric upload failed.', 'error');
      setStep('error');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setLocalPreview('');
    setRecordId('');
    setStep('select');
  };

  // Compute full static url for uploaded image
  const serverBase = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
  const imageUrl = record?.uploadedFile?.url ? `${serverBase}${record.uploadedFile.url}` : localPreview;

  return (
    <div className="flex flex-col gap-6 animate-slide-down max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Face Recognition</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
          Verify identities against database profiles
        </p>
      </div>

      {/* STEP 1: Selection Dropzones */}
      {step === 'select' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main dropzone */}
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
              <Upload className="h-10 w-10 text-indigo-500 mb-4 animate-bounce" />
              <p className="text-sm font-bold text-slate-800">Drag & drop photo here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse local files (JPEG, PNG up to 10MB)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => cameraInputRef.current?.click()} variant="outline" className="flex items-center justify-center gap-2 py-3 bg-white">
                <Camera className="h-4 w-4" /> Selfie Capture
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="user"
                  className="hidden"
                />
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex items-center justify-center gap-2 py-3 bg-white">
                <FileImage className="h-4 w-4" /> Open Camera Roll
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4">
                Query Picture
              </h2>
              {selectedFile ? (
                <div className="flex flex-col gap-3">
                  <div className="border border-slate-100 rounded-xl overflow-hidden aspect-square bg-slate-950 flex items-center justify-center">
                    <img src={localPreview} alt="Face Snapshot" className="max-h-full max-w-full object-contain" />
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
                  <p className="text-xs">No snapshot selected</p>
                </div>
              )}
            </div>

            {selectedFile && (
              <Button onClick={handleUpload} className="w-full mt-6 py-2.5 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10">
                Run Facial Biometrics Match <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Uploading state */}
      {step === 'uploading' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <Loader message="Uploading facial biometric photo..." size="lg" />
        </div>
      )}

      {/* STEP 3: Polling matching processing */}
      {step === 'processing' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[350px]">
          <div className="relative mb-6">
            <div className="h-16 w-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <UserCheck className="absolute inset-0 m-auto h-6 w-6 text-indigo-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Biometric Analysis Active</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Extracting vector embeddings, calculating cosine similarities, and matching signatures. This takes roughly 3-6 seconds...
          </p>
        </div>
      )}

      {/* STEP 4: Results Display */}
      {step === 'result' && record && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-slide-down">
          {/* Left panel: Uploaded photo preview */}
          <div className="lg:col-span-1 bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-3">
              Query Snapshot
            </h2>
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[300px] aspect-square">
              <img src={imageUrl} alt="Query Snapshot" className="max-h-full max-w-full object-contain" />
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full mt-4 text-xs py-2 font-bold flex items-center justify-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Try Another Photo
            </Button>
          </div>

          {/* Right panel: Match Details */}
          <div className="lg:col-span-2">
            {record.recognizedResult?.matched ? (
              /* MATCH FOUND */
              <div className="bg-white border border-slate-100 rounded-xl shadow-xs p-6 flex flex-col gap-6">
                {/* Visual verification alert */}
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-700">
                    <UserCheck className="h-5 w-5 shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Biometric Match Confirmed</h3>
                    <p className="text-[11px] text-emerald-700/80 leading-relaxed mt-0.5">
                      Face signatures matched with similarity score of {(record.recognizedResult.similarityScore! * 100).toFixed(0)}%.
                    </p>
                  </div>
                </div>

                {/* Profile Card details */}
                <div>
                  <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Matched Contact Card</h3>
                  {record.contact ? (
                    <div className="p-4 border border-slate-100 hover:border-indigo-100 hover:bg-slate-50/20 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm tracking-wide">
                          {record.contact.name
                            .split(/\s+/)
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{record.contact.name}</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">
                            {record.contact.designation || 'No title'} {record.contact.company ? `@ ${record.contact.company}` : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate(`/contacts/${record.contact?.id}`)}
                        variant="outline"
                        className="text-xs py-1.5 px-3 border border-indigo-200 text-indigo-600 hover:bg-indigo-50/30"
                      >
                        View Profile
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Contact properties could not be resolved.</p>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Similarity Score</p>
                    <p className="text-lg font-extrabold text-slate-800 mt-1">
                      {(record.recognizedResult.similarityScore! * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Liveness / Det Score</p>
                    <p className="text-lg font-extrabold text-slate-800 mt-1">
                      {record.recognizedResult.det_score ? `${(record.recognizedResult.det_score * 100).toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* NO MATCH FOUND */
              <div className="bg-white border border-slate-100 rounded-xl shadow-xs p-8 text-center flex flex-col items-center justify-center">
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-full mb-4 inline-flex items-center justify-center text-rose-500">
                  <UserX className="h-10 w-10 shrink-0" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">No Match Found</h2>
                <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                  The query facial signature was successfully parsed but similarity metrics fell below the 60% similarity verification threshold against all database profiles.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button onClick={handleReset} className="text-xs py-1.5 px-4 font-bold">
                    Try Another Photo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 5: Ingestion failures state */}
      {step === 'error' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Biometric Parsing Failed</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            Could not parse valid facial embeddings from the query image. Ensure the image has clear illumination, has good clarity, and contains exactly one face.
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
