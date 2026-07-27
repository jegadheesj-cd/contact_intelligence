export interface FaceCandidate {
  url: string;
  source: string;
  confidence: number;
  previewImage?: string;
  title?: string;
}

export interface ReverseFaceSearchResponse {
  success: boolean;
  provider: string;
  candidates: FaceCandidate[];
  message?: string;
  error?: string;
}

export interface IReverseFaceSearchProvider {
  readonly name: string;
  search(imagePath: string): Promise<ReverseFaceSearchResponse>;
}
