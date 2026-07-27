import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { FaceRecord } from '../types/face';

// 1. Upload biometric selfie photo for matching
export function useUploadFacePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, contactId }: { file: File; contactId?: string }) => {
      const formData = new FormData();
      formData.append('facePhoto', file);
      if (contactId) {
        formData.append('contactId', contactId);
      }

      const response = await api.post<ApiResponse<FaceRecord>>('/face/upload', formData, {
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

// 2. Poll face record details matching status
export function useFaceRecord(id: string, isPolling: boolean = false) {
  return useQuery<FaceRecord>({
    queryKey: ['face-record', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<FaceRecord>>(`/face/profile/${id}`);
      return response.data.data;
    },
    enabled: !!id,
    refetchInterval: isPolling ? 1500 : false, // Poll every 1.5s while matching is processing
  });
}

// 3. Poll face recognition job progress
export function useFaceProgress(id: string, isPolling: boolean = false) {
  return useQuery<{ progress: number | object }>({
    queryKey: ['face-progress', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<{ progress: number | object }>>(`/face/profile/${id}/progress`);
      return response.data.data;
    },
    enabled: !!id && isPolling,
    refetchInterval: isPolling ? 500 : false, // Poll rapidly for smooth UI progress
  });
}

// 4. Fetch face search history
export function useFaceHistory(page: number, limit: number, status?: string, provider?: string) {
  return useQuery<any>({
    queryKey: ['face-history', page, limit, status, provider],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (status) params.append('status', status);
      if (provider) params.append('provider', provider);
      
      const response = await api.get<ApiResponse<any>>(`/face/history?${params.toString()}`);
      return response.data.data;
    },
  });
}
