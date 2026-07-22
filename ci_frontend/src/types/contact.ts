export interface Tag {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
}

export interface Note {
  id: string;
  contactId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalProfile {
  id: string;
  contactId: string;
  providerResponses?: any;
  mergedProfile?: any;
  sourceAttribution?: any;
  verificationConfidence?: number;
  verificationStatus?: string;
  providersUsed: string[];
  enrichmentStatus: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'FETCHING_PROFILE' | 'VERIFYING' | 'GENERATING_SUMMARY' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface AiSummary {
  id: string;
  contactId: string;
  summaryText?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ContactSource = 'MANUAL' | 'BUSINESS_CARD' | 'QR' | 'NFC' | 'LINKEDIN';

export interface Contact {
  id: string;
  userId: string;
  name: string;
  company?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  source: ContactSource;
  decisionMakerScore: number;
  skills: string[];
  industry?: string | null;
  experience?: string | null;
  education?: string | null;
  interests: string[];
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
  notes?: Note[];
  professionalProfile?: ProfessionalProfile | null;
  aiSummary?: AiSummary | null;
}

export interface ContactPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ContactListResponse {
  contacts: Contact[];
  pagination: ContactPagination;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details?: any;
  createdAt: string;
}
