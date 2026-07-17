import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { Contact } from '../types/contact';

export interface QrFields {
  name?: string;
  company?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  linkedin_url?: string;
}

export interface QrReadResult {
  decodedText: string;
  parsedFields: QrFields;
  metadata: {
    format: string;
    confidence: number;
    mimeType: string;
    originalName: string;
  };
}

export interface NfcRecord {
  id: string;
  contactId: string;
  payload: any;
  createdAt: string;
  contact?: Contact;
}

// 1. Decodes uploaded QR code images
export function useReadQrCode() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('qrImage', file);

      const response = await api.post<ApiResponse<QrReadResult>>('/qr/read', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    },
  });
}

// 2. Records scanned NFC tag payloads
export function useReadNfcTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, contactId }: { payload: any; contactId?: string }) => {
      const response = await api.post<ApiResponse<NfcRecord>>('/nfc/read', {
        payload,
        contactId: contactId || undefined,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    },
  });
}
