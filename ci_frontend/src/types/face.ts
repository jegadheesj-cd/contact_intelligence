import type { Contact } from './contact';
import type { UploadedFile } from './scanner';

export interface FaceMatchResult {
  localMatch?: {
    matched: boolean;
    contactId?: string | null;
    similarityScore?: number;
    boundingBox?: number[];
    det_score?: number;
    message?: string;
  };
  osintMatch?: {
    success: boolean;
    provider?: string;
    candidates?: Array<{
      provider: string;
      sourceUrl: string;
      confidence: number;
      metadata?: any;
    }>;
  };
}

export interface FaceRecord {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  recognizedResult?: FaceMatchResult | null;
  uploadedFileId: string;
  uploadedFile: UploadedFile;
  contactId?: string | null;
  contact?: Contact | null;
  createdAt: string;
  updatedAt: string;
}
