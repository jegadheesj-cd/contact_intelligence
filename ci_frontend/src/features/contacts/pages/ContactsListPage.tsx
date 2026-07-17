import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '../../../hooks/useContacts';
import { useToastStore } from '../../../store/useToastStore';
import { Loader } from '../../../components/Loader';
import { Button } from '../../../components/Button';
import { ContactFormModal } from '../components/ContactFormModal';
import { ConfirmModal } from '../../../components/ConfirmModal';
import {
  Search,
  Plus,
  ArrowUpDown,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  User,
  Filter,
  CheckCircle,
  Clock,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import type { Contact } from '../../../types/contact';

export const ContactsListPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // Filter and pagination local states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch list hook
  const { data, isLoading, isError, refetch } = useContacts({
    page,
    limit,
    search: debouncedSearch,
    source: source || undefined,
    sortBy,
    sortOrder,
  });

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  const handleFormSubmit = async (formData: any) => {
    try {
      if (editingContact) {
        await updateMutation.mutateAsync({ id: editingContact.id, data: formData });
        addToast('Contact updated successfully.', 'success');
      } else {
        await createMutation.mutateAsync(formData);
        addToast('Contact created successfully.', 'success');
      }
      setIsFormOpen(false);
      setEditingContact(null);
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingContactId) return;
    try {
      await deleteMutation.mutateAsync(deletingContactId);
      addToast('Contact deleted successfully.', 'success');
      setIsDeleteOpen(false);
      setDeletingContactId(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to delete contact.', 'error');
    }
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (data?.pagination.totalPages || 1)) {
      setPage(newPage);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Contacts Directory</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            Manage your network profiles
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingContact(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 self-start sm:self-auto py-2 px-4 shadow-md shadow-indigo-600/10"
        >
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      {/* Filters Canvas Grid */}
      <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-lg text-sm outline-none transition-all"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>

        {/* Filters Select boxes */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Source Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 text-xs font-semibold text-slate-700 bg-white rounded-lg p-2 outline-none"
            >
              <option value="">All Sources</option>
              <option value="MANUAL">Manual</option>
              <option value="BUSINESS_CARD">Business Card</option>
              <option value="QR">QR Code</option>
              <option value="NFC">NFC Scan</option>
              <option value="LINKEDIN">LinkedIn</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="border border-slate-200 text-xs font-semibold text-slate-700 bg-white rounded-lg p-2 outline-none"
          >
            <option value="createdAt">Date Created</option>
            <option value="name">Name</option>
            <option value="company">Company</option>
            <option value="decisionMakerScore">Decision Maker Score</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={toggleSortOrder}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg outline-none transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main List canvas */}
      {isLoading ? (
        <div className="bg-white border border-slate-100 rounded-xl p-12 flex justify-center shadow-xs">
          <Loader message="Fetching contact directories..." size="md" />
        </div>
      ) : isError ? (
        <div className="bg-white border border-slate-100 rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-xs">
          <AlertCircle className="h-10 w-10 text-rose-500 mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">Could not fetch contacts</h3>
          <p className="text-xs text-slate-500 mb-6">Verify your backend local server connection.</p>
          <Button onClick={() => refetch()} variant="outline" className="text-xs">
            Try Again
          </Button>
        </div>
      ) : data?.contacts && data.contacts.length > 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden flex flex-col">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-500">
              <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Profile Card</th>
                  <th className="py-3 px-6 hidden sm:table-cell">Source</th>
                  <th className="py-3 px-6">DM Score</th>
                  <th className="py-3 px-6 hidden md:table-cell">Enrichment</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {data.contacts.map((contact) => {
                  const initials = contact.name
                    .split(/\s+/)
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  const score = contact.decisionMakerScore;
                  const pillColor =
                    score >= 80
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : score >= 50
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-slate-100 text-slate-600 border-slate-200';

                  const enrichmentStatus = contact.linkedInProfile?.enrichmentStatus || 'PENDING';

                  return (
                    <tr
                      key={contact.id}
                      className="hover:bg-slate-50/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      {/* Name/Avatar block */}
                      <td className="py-4 px-6 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs tracking-wide shrink-0">
                          {initials || <User className="h-4 w-4" />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-slate-900 truncate leading-snug hover:text-indigo-600 transition-colors">
                            {contact.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-semibold truncate leading-none mt-1 flex items-center gap-1">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            {contact.designation || 'No title'} {contact.company ? `@ ${contact.company}` : ''}
                          </p>
                        </div>
                      </td>

                      {/* Source badge */}
                      <td className="py-4 px-6 hidden sm:table-cell">
                        <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase border border-slate-200">
                          {contact.source.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Score Badge */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${pillColor}`}>
                          Score: {score}
                        </span>
                      </td>

                      {/* Enrichment Status */}
                      <td className="py-4 px-6 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          {enrichmentStatus === 'COMPLETED' ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                              <span className="text-[11px] font-bold text-slate-600">Enriched</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-slate-400 animate-pulse" />
                              <span className="text-[11px] font-semibold text-slate-400">Pending</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Row Actions */}
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingContact(contact);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg outline-none transition-colors"
                            title="Edit Profile"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingContactId(contact.id);
                              setIsDeleteOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg outline-none transition-colors"
                            title="Delete Contact"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="h-14 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between px-6 shrink-0">
            <span className="text-xs font-semibold text-slate-500">
              Page {page} of {data.pagination.totalPages || 1} ({data.pagination.total} total)
            </span>

            <div className="flex items-center gap-4">
              {/* Limit selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="border border-slate-200 text-xs font-semibold text-slate-700 bg-white rounded-lg p-1.5 outline-none"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>

              {/* Prev / Next */}
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 rounded-lg outline-none transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === data.pagination.totalPages}
                  className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 rounded-lg outline-none transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-slate-100 rounded-xl p-16 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-full mb-4 inline-flex items-center justify-center">
            <User className="h-10 w-10 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No contacts found</h3>
          <p className="text-xs text-slate-500 mb-6 max-w-xs leading-relaxed">
            Create a contact manually, upload a business card, scan a QR code, or read an NFC tag to populate your directory.
          </p>
          <Button
            onClick={() => {
              setEditingContact(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs py-2 px-4 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Manual Contact
          </Button>
        </div>
      )}

      {/* CRUD Form Modal */}
      <ContactFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        contact={editingContact}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This will delete all associated cards, notes, and activity histories."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
