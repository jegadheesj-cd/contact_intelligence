import type { Contact } from './contact';

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  checksum: string;
  checksumAlgo: string;
  contactId?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedFields {
  name?: string | null;
  company?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  linkedin_url?: string | null;
}

export interface ExtractedData {
  rawOcrText?: string | null;
  qrPresent?: boolean;
  qrData?: string[];
  fields?: ExtractedFields;
}

export interface BusinessCard {
  id: string;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  extractedData?: ExtractedData | null;
  uploadedFileId: string;
  uploadedFile: UploadedFile;
  contactId?: string | null;
  contact?: Contact | null;
  createdAt: string;
  updatedAt: string;
}
