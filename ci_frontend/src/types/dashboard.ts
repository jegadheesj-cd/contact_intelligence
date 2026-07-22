export interface OcrStat {
  status: string;
  count: number;
}

export interface FaceStat {
  status: string;
  count: number;
}

export interface CommonCompany {
  company: string;
  count: number;
}

export interface CommonIndustry {
  industry: string;
  count: number;
}

export interface CommonSkill {
  skill: string;
  count: number;
}

export interface RecentUpload {
  id: string;
  contactId?: string | null;
  uploadedFileId: string;
  createdAt: string;
  updatedAt: string;
  ocrStatus: string;
  extractedData?: any;
  uploadedFile: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
  };
}

export interface DashboardWidgets {
  totalContacts: number;
  recentUploads: RecentUpload[];
  ocrStats: OcrStat[];
  faceStats: FaceStat[];
  commonCompanies: CommonCompany[];
  commonIndustries: CommonIndustry[];
  commonSkills: CommonSkill[];
  verificationRate?: number;
  aiSummaryCoverage?: number;
}

export interface QueueCount {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface QueueStatuses {
  ocrQueue: QueueCount;
  faceRecognitionQueue: QueueCount;
  enrichmentQueue: QueueCount;
  aiSummaryQueue: QueueCount;
}

export interface DashboardAnalytics {
  ocrSuccessRate: number;
  failedOcrCount: number;
  averageOcrTimeMs: number;
  recognitionAccuracy: number;
  failedRecognitionCount: number;
  averageRecognitionTimeMs: number;
  queueStatuses: QueueStatuses;
}
