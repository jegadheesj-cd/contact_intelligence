import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { Contact, ContactListResponse, Note, AuditLog } from '../types/contact';

// 1. Fetch paginated list of contacts with sorting & filter matching
export function useContacts(params: {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  source?: string;
  tags?: string;
}) {
  return useQuery<ContactListResponse>({
    queryKey: ['contacts', params],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ContactListResponse>>('/contacts', {
        params: {
          page: params.page,
          limit: params.limit,
          search: params.search || undefined,
          sortBy: params.sortBy || 'createdAt',
          sortOrder: params.sortOrder || 'desc',
          source: params.source || undefined,
          tags: params.tags || undefined,
        },
      });
      return response.data.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache validity
  });
}

// 2. Fetch detailed contact card by ID
export function useContact(id: string, isPolling: boolean = false) {
  return useQuery<Contact>({
    queryKey: ['contact', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Contact>>(`/contacts/${id}`);
      return response.data.data;
    },
    enabled: !!id,
    refetchInterval: isPolling ? 1500 : false,
  });
}

// 3. Create a new contact manually
export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Contact> & { notes?: string }) => {
      const response = await api.post<ApiResponse<Contact>>('/contacts', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// 4. Update contact details
export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contact> }) => {
      const response = await api.patch<ApiResponse<Contact>>(`/contacts/${id}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', data.id] });
    },
  });
}

// 5. Delete contact (with optimistic query update)
export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ApiResponse<any>>(`/contacts/${id}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// 6. Append a Note to a contact
export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, content }: { contactId: string; content: string }) => {
      const response = await api.post<ApiResponse<Note>>(`/contacts/${contactId}/notes`, { content });
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact', variables.contactId] });
    },
  });
}

// 7. Delete a Note from a contact
export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, noteId }: { contactId: string; noteId: string }) => {
      console.log('Deleting note from contact ID:', contactId);
      const response = await api.delete<ApiResponse<any>>(`/contacts/notes/${noteId}`);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact', variables.contactId] });
    },
  });
}

// 8. Fetch duplicate contacts
export function useDuplicates(id: string) {
  return useQuery<any[]>({
    queryKey: ['duplicates', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<any[]>>(`/contacts/${id}/duplicates`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

// 9. Fetch contact timeline history
export function useTimeline(id: string) {
  return useQuery<AuditLog[]>({
    queryKey: ['timeline', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<AuditLog[]>>(`/contacts/${id}/timeline`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

// 10. Trigger profile enrichment
export function useTriggerEnrichment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) => {
      const response = await api.post<ApiResponse<any>>('/profile-enrichment/trigger', { contactId });
      return response.data.data;
    },
    onSuccess: (_, _contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contact', _contactId] });
    },
  });
}
