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
