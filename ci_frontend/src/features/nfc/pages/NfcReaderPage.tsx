import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReadNfcTag } from '../../../hooks/useIngestion';
import { useUpdateContact } from '../../../hooks/useContacts';
import { useToastStore } from '../../../store/useToastStore';
import { Loader } from '../../../components/Loader';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import {
  Nfc,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Compass,
} from 'lucide-react';

export const NfcReaderPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  const [step, setStep] = useState<'idle' | 'listening' | 'processing' | 'review' | 'error'>('idle');
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [linkedContactId, setLinkedContactId] = useState('');

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

  // NFC Mutations hooks
  const readNfcMutation = useReadNfcTag();
  const updateContactMutation = useUpdateContact();

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
      // @ts-ignore (NDEFReader type may not be present in standard TS DOM lib)
      const ndef = new NDEFReader();
      await ndef.scan();
      addToast('NFC antenna active. Place tag near device.', 'info');

      ndef.addEventListener('reading', async ({ message }: any) => {
        setStep('processing');
        try {
          // Parse NDEF records collection
          const records = message.records.map((record: any) => {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            return {
              type: record.recordType,
              payload: textDecoder.decode(record.data),
            };
          });

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
            linkedInUrl: contact.linkedInProfile?.linkedInUrl || contact.website || '',
          });
          setStep('review');
          addToast('NFC Tag successfully scanned and processed.', 'success');
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
        linkedInUrl: contact.linkedInProfile?.linkedInUrl || contact.website || '',
      });
      setStep('review');
      addToast('Simulated NFC tag tapped successfully.', 'success');
    } catch (err: any) {
      addToast(err.message || 'NFC simulation failed.', 'error');
      setStep('error');
    }
  };

  // Confirm save manually corrected fields
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedContactId) {
      addToast('No linked contact found to update.', 'error');
      return;
    }

    try {
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
        id: linkedContactId,
        data: contactPayload as any,
      });

      addToast('NFC Contact details confirmed and saved.', 'success');
      navigate(`/contacts/${linkedContactId}`);
    } catch (err: any) {
      addToast(err.message || 'Failed to save contact adjustments.', 'error');
    }
  };

  const handleReset = () => {
    setLinkedContactId('');
    setStep('idle');
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">NFC Reader</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
          Import profiles by scanning NFC tags
        </p>
      </div>

      {/* STEP 1: Idle dashboard scanner */}
      {step === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main workspace */}
          <div className="md:col-span-2 flex flex-col gap-4">
            {/* NFC Availability Banners */}
            {isNfcSupported ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[260px] shadow-xs">
                <Nfc className="h-12 w-12 text-indigo-500 mb-4 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-800">Web NFC Sensor Available</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Start scanning and hover your NFC-enabled business cards against the back of your mobile device.
                </p>
                <Button onClick={startNfcListening} className="mt-6 py-2 px-6 text-xs font-bold shadow-sm">
                  Activate NFC Antenna
                </Button>
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[260px]">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
                <h2 className="text-sm font-bold text-slate-800">NFC Sensor Unavailable</h2>
                <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                  Web NFC API is not supported on this browser/desktop device. To test real scans, open this website on Chrome for Android.
                </p>
              </div>
            )}

            {/* Ingestion Simulator Console (Allows desktop paired testing) */}
            <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
              <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-indigo-500" /> NFC Simulator Console
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Simulate physical tag taps with normalized payloads to verify database integrations:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  onClick={() => handleSimulatedNfcTap('vcard')}
                  variant="outline"
                  className="py-2.5 text-xs bg-slate-50 font-semibold border-slate-200"
                >
                  Tap vCard Tag
                </Button>
                <Button
                  onClick={() => handleSimulatedNfcTap('json')}
                  variant="outline"
                  className="py-2.5 text-xs bg-slate-50 font-semibold border-slate-200"
                >
                  Tap flat JSON Tag
                </Button>
                <Button
                  onClick={() => handleSimulatedNfcTap('linkedin')}
                  variant="outline"
                  className="py-2.5 text-xs bg-slate-50 font-semibold border-slate-200"
                >
                  Tap LinkedIn vCard
                </Button>
              </div>
            </div>
          </div>

          {/* User Guidances */}
          <div className="bg-white p-5 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-3">
              Tag Guidance
            </h2>
            <ul className="text-xs text-slate-500 space-y-2 leading-relaxed font-semibold">
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
            <Button onClick={handleReset} variant="outline" className="text-xs py-1.5 px-4">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Processing payload updates */}
      {step === 'processing' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <Loader message="Importing and structuring NFC card records..." size="lg" />
        </div>
      )}

      {/* STEP 4: Review and adjust details */}
      {step === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-slide-down">
          {/* Status info bar */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800">
              <h3 className="text-xs font-bold flex items-center gap-1.5 leading-none">
                <ShieldCheck className="h-4 w-4" /> Tag Scanned
              </h3>
              <p className="text-[11px] text-indigo-700/80 leading-relaxed mt-1.5">
                The NFC card details have been successfully written to the database. Align values below before confirm-saving the profile.
              </p>
            </div>
          </div>

          {/* Form edit panels */}
          <div className="lg:col-span-2 bg-white p-6 border border-slate-100 rounded-xl shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-4">
              Verify Contact Card details
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
                  Discard Scan
                </Button>
                <Button
                  type="submit"
                  isLoading={updateContactMutation.isPending}
                  disabled={!formFields.name}
                  className="flex-1 py-2 text-xs font-bold"
                >
                  Confirm & Link Profile <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 5: Ingestion failures state */}
      {step === 'error' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs min-h-[300px]">
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">NFC Reading Failed</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            Could not parse normalized records from the tapped NFC tag. Ensure the tag holds standard NDEF text or vCard payloads.
          </p>
          <div className="mt-8 flex gap-3">
            <Button onClick={handleReset} variant="outline" className="text-xs py-1.5 px-3">
              Clear & Go Back
            </Button>
            <Button
              onClick={isNfcSupported ? startNfcListening : () => handleSimulatedNfcTap('vcard')}
              className="flex items-center gap-1.5 text-xs py-1.5 px-4"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try Scanning Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
