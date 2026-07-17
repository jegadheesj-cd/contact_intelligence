import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { BusinessCard } from '../types/scanner';

// 1. Upload business card multipart image
export function useUploadCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, contactId }: { file: File; contactId?: string }) => {
      const formData = new FormData();
      formData.append('cardImage', file);
      if (contactId) {
        formData.append('contactId', contactId);
      }
      const response = await api.post<ApiResponse<BusinessCard>>('/business-card/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    },
  });
}

// 2. Fetch business card status with conditional polling
export function useCardDetails(id: string, isPolling: boolean = false) {
  return useQuery<BusinessCard>({
    queryKey: ['business-card', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<BusinessCard>>(`/business-card/${id}`);
      return response.data.data;
    },
    enabled: !!id,
    refetchInterval: isPolling ? 1500 : false, // Poll every 1.5s while processing
  });
}

// 3. Delete business card
export function useDeleteCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ApiResponse<any>>(`/business-card/${id}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    },
  });
}
