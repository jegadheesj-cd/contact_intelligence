import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReadNfcTag } from '../../../hooks/useIngestion';
import { useUpdateContact, useCreateContact, useTriggerEnrichment } from '../../../hooks/useContacts';
import { useToastStore } from '../../../store/useToastStore';
import { Button } from '../../../components/Button';
import {
  Nfc,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Compass,
  Edit2,
  Check,
  X,
} from 'lucide-react';

export const NfcReaderPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // Workflow states: 'idle' | 'listening' | 'processing' | 'review' | 'error'
  const [step, setStep] = useState<'idle' | 'listening' | 'processing' | 'review' | 'error'>('idle');
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [linkedContactId, setLinkedContactId] = useState('');

  // NFC scanning progress states
  const [nfcProgress, setNfcProgress] = useState<'detected' | 'reading' | 'extracting' | 'completed' | null>(null);

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

  // NFC Mutations hooks
  const readNfcMutation = useReadNfcTag();
  const updateContactMutation = useUpdateContact();
  const createContactMutation = useCreateContact();
  const triggerEnrichmentMutation = useTriggerEnrichment();

  // Detect Web NFC support on mount
  useEffect(() => {
    if ('NDEFReader' in window) {
      setIsNfcSupported(true);
    }
  }, []);

  // Web NFC Reader Scanner loop
  const startNfcListening = async () => {
    if (!isNfcSupported) return;
    setStep('listening');
    try {
      // @ts-ignore
      const ndef = new NDEFReader();
      await ndef.scan();
      addToast('NFC antenna active. Place tag near device.', 'info');

      ndef.addEventListener('reading', async ({ message }: any) => {
        setStep('processing');
        setNfcProgress('detected');
        
        try {
          // Parse NDEF records collection
          const records = message.records.map((record: any) => {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            return {
              type: record.recordType,
              payload: textDecoder.decode(record.data),
            };
          });

          await new Promise((resolve) => setTimeout(resolve, 600));
          setNfcProgress('reading');
          
          await new Promise((resolve) => setTimeout(resolve, 600));
          setNfcProgress('extracting');

          const response = await readNfcMutation.mutateAsync({ payload: { records } });
          const contact = response.contact || ({} as any);
          
          setLinkedContactId(contact.id || '');
          setFormFields({
            name: contact.name || '',
            company: contact.company || '',
            designation: contact.designation || '',
            email: contact.email || '',
            phone: contact.phone || '',
            website: contact.website || '',
            address: contact.address || '',
            linkedInUrl: contact.professionalProfile?.mergedProfile?.profileUrl || contact.website || '',
          });

          setNfcProgress('completed');
          addToast('NFC Tag successfully scanned and processed.', 'success');
          
          await new Promise((resolve) => setTimeout(resolve, 500));
          setStep('review');
        } catch (err: any) {
          addToast(err.message || 'Failed to process NFC tag content.', 'error');
          setStep('error');
        }
      });
    } catch (err: any) {
      addToast('NFC scanner activation failed.', 'error');
      setStep('error');
    }
  };

  // Ingestion Simulator for desktop testing
  const handleSimulatedNfcTap = async (payloadType: 'vcard' | 'json' | 'linkedin') => {
    setStep('processing');
    setNfcProgress('detected');

    let simulatedPayload: any = '';

    if (payloadType === 'vcard') {
      simulatedPayload =
        'BEGIN:VCARD\nFN:Richard Hendricks\nORG:Pied Piper\nTITLE:CEO\nEMAIL:richard@piedpiper.com\nTEL:+1-555-987-6543\nURL:https://piedpiper.com\nADR:Palo Alto, CA\nEND:VCARD';
    } else if (payloadType === 'json') {
      simulatedPayload = {
        name: 'Erlich Bachman',
        company: 'Bachmanity Incubator',
        designation: 'Managing Partner',
        email: 'erlich@bachmanity.co',
        phone: '+1-555-111-2222',
        website: 'https://bachmanity.co',
        address: 'Silicon Valley, CA',
      };
    } else {
      simulatedPayload =
        'BEGIN:VCARD\nFN:Monica Hall\nORG:Raviga Capital\nTITLE:Partner\nEMAIL:monica@raviga.com\nURL:https://linkedin.com/in/monica-hall\nEND:VCARD';
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setNfcProgress('reading');

      await new Promise((resolve) => setTimeout(resolve, 600));
      setNfcProgress('extracting');

      const response = await readNfcMutation.mutateAsync({ payload: simulatedPayload });
      const contact = response.contact || ({} as any);
      
      setLinkedContactId(contact.id || '');
      setFormFields({
        name: contact.name || '',
        company: contact.company || '',
        designation: contact.designation || '',
        email: contact.email || '',
        phone: contact.phone || '',
        website: contact.website || '',
        address: contact.address || '',
        linkedInUrl: contact.professionalProfile?.mergedProfile?.profileUrl || contact.website || '',
      });

      setNfcProgress('completed');
      addToast('Simulated NFC tag tapped successfully.', 'success');

      await new Promise((resolve) => setTimeout(resolve, 500));
      setStep('review');
    } catch (err: any) {
      addToast(err.message || 'NFC simulation failed.', 'error');
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

  // Confirm save manually corrected fields
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();

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

      let finalContactId = linkedContactId;

      if (finalContactId) {
        try {
          await updateContactMutation.mutateAsync({
            id: finalContactId,
            data: contactPayload as any,
          });
          addToast('Contact updated successfully.', 'success');
        } catch (updateErr) {
          const newContact = await createContactMutation.mutateAsync({
            ...contactPayload,
            source: 'NFC',
          } as any);
          finalContactId = newContact.id;
          addToast('Created new contact profile successfully.', 'success');
        }
      } else {
        const newContact = await createContactMutation.mutateAsync({
          ...contactPayload,
          source: 'NFC',
        } as any);
        finalContactId = newContact.id;
        addToast('Contact created successfully.', 'success');
      }

      if (finalContactId) {
        try {
          await triggerEnrichmentMutation.mutateAsync(finalContactId);
          addToast('Profile enrichment started.', 'info');
        } catch (enrichErr: any) {
          addToast('Failed to start profile enrichment.', 'error');
        }
      }

      navigate(`/contacts/${finalContactId}`);
    } catch (err: any) {
      addToast(err.message || 'Failed to save contact adjustments.', 'error');
    }
  };

  const handleReset = () => {
    setLinkedContactId('');
    setNfcProgress(null);
    setStep('idle');
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 leading-tight">NFC Reader</h1>
          <p className="text-xs text-slate-400 mt-1">
            Import digital contact profiles by tapping NFC hardware tags or smart business cards.
          </p>
        </div>
        {step !== 'idle' && (
          <Button onClick={handleReset} variant="outline" className="text-xs text-slate-500 hover:text-slate-800">
            Cancel Scan
          </Button>
        )}
      </div>

      {/* STEP 1: Idle dashboard scanner */}
      {step === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main workspace */}
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* NFC Availability Banners */}
            {isNfcSupported ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[240px] shadow-xs">
                <div className="p-4 bg-indigo-50 text-indigo-650 rounded-full mb-3 animate-pulse">
                  <Nfc className="h-8 w-8" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">NFC Scanner Ready</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Activate your antenna and place your NFC-enabled business cards against the back of your mobile device.
                </p>
                <Button onClick={startNfcListening} className="mt-6 py-2 px-6 text-xs font-bold shadow-sm shadow-indigo-600/10">
                  Activate NFC Antenna
                </Button>
              </div>
            ) : (
              <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[240px]">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
                <h2 className="text-sm font-bold text-slate-800">NFC Support Unavailable</h2>
                <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                  Web NFC API is not supported on this browser/desktop device. You can test NFC scans using the Simulator Console below.
                </p>
              </div>
            )}

            {/* Ingestion Simulator Console */}
            <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
              <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-indigo-500" /> NFC Simulator Console
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-4 font-semibold">
                Simulate a physical tag tap with formatted payload profiles to test the database ingestion workflow:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  onClick={() => handleSimulatedNfcTap('vcard')}
                  variant="outline"
                  className="py-2 text-xs bg-slate-50 font-semibold border-slate-200"
                >
                  Tap standard vCard
                </Button>
                <Button
                  onClick={() => handleSimulatedNfcTap('json')}
                  variant="outline"
                  className="py-2 text-xs bg-slate-50 font-semibold border-slate-200"
                >
                  Tap flat JSON Tag
                </Button>
                <Button
                  onClick={() => handleSimulatedNfcTap('linkedin')}
                  variant="outline"
                  className="py-2 text-xs bg-slate-50 font-semibold border-slate-200"
                >
                  Tap LinkedIn vCard
                </Button>
              </div>
            </div>
          </div>

          {/* User Guidances */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs flex flex-col gap-3">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase">
              Tag Guidance
            </h2>
            <ul className="text-xs text-slate-500 space-y-2.5 leading-relaxed font-semibold">
              <li>• NFC card tags should contain standard NDEF records.</li>
              <li>• Mobile browser settings might require turning on NFC permissions.</li>
              <li>• Keep the tag hovered for 2-3 seconds until the beep completes.</li>
            </ul>
          </div>
        </div>
      )}

      {/* STEP 2: Listening status indicator */}
      {step === 'listening' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[350px]">
          <div className="relative mb-6">
            <div className="h-16 w-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <Nfc className="absolute inset-0 m-auto h-6 w-6 text-indigo-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Awaiting Tag Tap...</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Hold your smart card close to the NFC reader antenna. Make sure NFC is enabled on your device.
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={handleReset} variant="outline" className="text-xs py-1.5 px-4 border-slate-200">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Processing payload progress timeline */}
      {step === 'processing' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 flex flex-col items-center justify-center shadow-lg min-h-[350px] w-full animate-slide-down">
          <div className="relative mb-8">
            <div className="h-16 w-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <Nfc className="absolute inset-0 m-auto h-6 w-6 text-indigo-500 animate-pulse" />
          </div>
          
          <h2 className="text-xl font-black text-slate-800">Ingesting NFC Card Data</h2>
          
          {/* NFC Progress Indicator List */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mt-8 border-t border-slate-100 pt-6 w-full max-w-lg justify-center">
            {[
              { key: 'detected', label: 'NFC Detected' },
              { key: 'reading', label: 'Reading' },
              { key: 'extracting', label: 'Extracting' },
              { key: 'completed', label: 'Completed' },
            ].map((p, idx) => {
              const order = ['detected', 'reading', 'extracting', 'completed'];
              const currentIdx = order.indexOf(nfcProgress || 'detected');
              const targetIdx = order.indexOf(p.key);
              const isActive = p.key === nfcProgress;
              const isDone = targetIdx < currentIdx || nfcProgress === 'completed';

              return (
                <div key={p.key} className="flex items-center gap-2">
                  <span className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold
                    ${isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                      (isActive ? 'bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse' : 'bg-slate-50 text-slate-300 border-slate-100')}`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <span className={`text-xs font-bold ${isActive ? 'text-indigo-650' : (isDone ? 'text-emerald-700' : 'text-slate-450')}`}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 4: Review and adjust details */}
      {step === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-slide-down">
          {/* Status info bar */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-850">
              <h3 className="text-xs font-bold flex items-center gap-1.5 leading-none">
                <ShieldCheck className="h-4 w-4 text-indigo-600" /> NFC Tag Scanned
              </h3>
              <p className="text-[10px] text-indigo-750/90 leading-relaxed mt-2.5">
                The NFC card details have been successfully written. Align values below before saving the profile and starting OSINT AI enrichment.
              </p>
            </div>
          </div>

          {/* Form edit panels */}
          <div className="lg:col-span-8 bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                Verify NFC Credentials
              </h2>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Click the pencil icon to edit inline
              </span>
            </div>

            <div className="space-y-4">
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>

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
                          className="p-1.5 bg-indigo-50 text-indigo-650 rounded-lg hover:bg-indigo-100 cursor-pointer"
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
                          {value || `No ${f.label.toLowerCase()} loaded`}
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

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <Button type="button" onClick={handleReset} variant="outline" className="flex-1 py-2 text-xs border-slate-200">
                Discard
              </Button>
              <Button
                type="button"
                onClick={handleSaveContact}
                isLoading={updateContactMutation.isPending || createContactMutation.isPending}
                disabled={!formFields.name.trim()}
                className="flex-1 py-2 text-xs font-bold"
              >
                Confirm & Link Profile <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Ingestion failures state */}
      {step === 'error' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-base font-bold text-slate-800">NFC Reading Failed</h2>
          <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
            Could not parse valid records from the tapped NFC tag. Ensure the tag holds standard NDEF text or vCard payloads.
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={handleReset} variant="outline" className="text-xs py-1.5 px-3 border-slate-200">
              Clear & Go Back
            </Button>
            <Button
              onClick={isNfcSupported ? startNfcListening : () => handleSimulatedNfcTap('vcard')}
              className="flex items-center gap-1.5 text-xs py-1.5 px-4"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry Scan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
