import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, ShieldCheck } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import type { Contact } from '../../../types/contact';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  contact?: Contact | null; // If populated, we are editing
  isLoading?: boolean;
}

export const ContactFormModal: React.FC<ContactFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  contact = null,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      company: '',
      designation: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      linkedInUrl: '',
      skills: '',
      tags: '',
    },
  });

  // Reset values when contact is populated (edit mode) or modal opens
  useEffect(() => {
    if (isOpen) {
      if (contact) {
        reset({
          name: contact.name || '',
          company: contact.company || '',
          designation: contact.designation || '',
          email: contact.email || '',
          phone: contact.phone || '',
          website: contact.website || '',
          address: contact.address || '',
          linkedInUrl: contact.professionalProfile?.mergedProfile?.profileUrl || contact.website || '',
          skills: contact.skills ? contact.skills.join(', ') : '',
          tags: contact.tags ? contact.tags.map((t) => t.name).join(', ') : '',
        });
      } else {
        reset({
          name: '',
          company: '',
          designation: '',
          email: '',
          phone: '',
          website: '',
          address: '',
          linkedInUrl: '',
          skills: '',
          tags: '',
        });
      }
    }
  }, [contact, isOpen, reset]);

  if (!isOpen) return null;

  const handleFormSubmit = async (values: any) => {
    // Parse comma-separated skills and tags into arrays
    const formattedData = {
      ...values,
      skills: values.skills
        ? values.skills
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
      tags: values.tags
        ? values.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [],
    };
    await onSubmit(formattedData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
      />

      {/* Modal Card Layout */}
      <div className="bg-white border border-slate-100 shadow-xl rounded-2xl w-full max-w-lg relative z-10 animate-slide-down flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600 animate-pulse" />
            <h3 className="text-base font-bold text-slate-800">
              {contact ? 'Edit Contact Card' : 'Create New Contact'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg outline-none transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 overflow-y-auto p-6 flex flex-col">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input
              label="Contact Name (Required)"
              type="text"
              placeholder="Jane Smith"
              error={errors.name?.message}
              {...register('name', { required: 'Name is required' })}
            />

            <Input
              label="Company Name"
              type="text"
              placeholder="Innovate LLC"
              error={errors.company?.message}
              {...register('company')}
            />

            <Input
              label="Designation / Role"
              type="text"
              placeholder="Director of Operations"
              error={errors.designation?.message}
              {...register('designation')}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="jane@innovate.com"
              error={errors.email?.message}
              {...register('email', {
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email format',
                },
              })}
            />

            <Input
              label="Phone Number"
              type="text"
              placeholder="+1-555-123-4567"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Website URL"
              type="text"
              placeholder="https://innovate.com"
              error={errors.website?.message}
              {...register('website')}
            />

            <Input
              label="Address / Location"
              type="text"
              placeholder="Austin, TX"
              error={errors.address?.message}
              {...register('address')}
            />

            <Input
              label="LinkedIn URL"
              type="text"
              placeholder="https://linkedin.com/in/janesmith"
              error={errors.linkedInUrl?.message}
              {...register('linkedInUrl')}
            />
          </div>

          <Input
            label="Skills (Comma-separated)"
            type="text"
            placeholder="TypeScript, Project Management, Agile"
            error={errors.skills?.message}
            {...register('skills')}
          />

          <Input
            label="Tags (Comma-separated)"
            type="text"
            placeholder="Lead, VIP, Partner"
            error={errors.tags?.message}
            {...register('tags')}
          />

          {/* Form Actions Footer */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 shrink-0">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={isLoading}
              className="flex-1 py-2 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              className="flex-1 py-2 text-xs font-bold"
            >
              {contact ? 'Save Updates' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
