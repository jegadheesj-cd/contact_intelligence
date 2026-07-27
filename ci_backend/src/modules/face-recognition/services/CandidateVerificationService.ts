import { FaceCandidate } from '../providers/IReverseFaceSearchProvider';
import logger from '../../../config/logger';

export class CandidateVerificationService {
  /**
   * Verifies the reverse search candidates before passing them to the expensive enrichment pipeline.
   * Merges provider confidence with local facial similarity score.
   */
  public verifyCandidates(candidates: FaceCandidate[], localSimilarityScore: number = 0): FaceCandidate[] {
    logger.info(`[CandidateVerification] Starting verification for ${candidates.length} candidates. (Local Score: ${localSimilarityScore})`);
    
    const verified = candidates.map(candidate => {
      // 1. Normalize provider confidence to 0-100 scale
      let normalizedConfidence = candidate.confidence;
      if (normalizedConfidence <= 1 && normalizedConfidence > 0) {
        normalizedConfidence *= 100;
      }
      
      // 2. Adjust based on Source Reputation
      let finalConfidence = normalizedConfidence;
      const sourceScore = this.getSourceReputationScore(candidate.url);
      
      // Add bonus for highly trusted professional sources (e.g., LinkedIn)
      if (sourceScore === 'HIGH') finalConfidence += 10;
      if (sourceScore === 'LOW') finalConfidence -= 20;

      // 3. Cross-source agreement with local similarity
      if (localSimilarityScore > 0) {
        const normalizedLocal = localSimilarityScore <= 1 ? localSimilarityScore * 100 : localSimilarityScore;
        // Blend the scores: 70% OSINT provider confidence, 30% Local database verification
        finalConfidence = (finalConfidence * 0.7) + (normalizedLocal * 0.3);
      }

      // Cap at 99.9%
      finalConfidence = Math.min(finalConfidence, 99.9);

      return {
        ...candidate,
        confidence: parseFloat(finalConfidence.toFixed(2))
      };
    }).filter(candidate => {
      // Minimum verification threshold set to 65% after all weighting
      return candidate.confidence >= 65;
    });

    // Sort by highest confidence descending
    verified.sort((a, b) => b.confidence - a.confidence);

    logger.info(`[CandidateVerification] Verification complete. ${verified.length} candidates passed threshold.`);
    return verified;
  }

  private getSourceReputationScore(url: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      
      const highTrust = ['linkedin.com', 'github.com', 'scholar.google.com', 'researchgate.net'];
      const lowTrust = ['pinterest.com', 'stock', 'alamy', 'shutterstock', 'freepik', 'facebook.com', 'instagram.com'];
      
      if (highTrust.some(domain => hostname.includes(domain))) return 'HIGH';
      if (lowTrust.some(domain => hostname.includes(domain))) return 'LOW';

      return 'MEDIUM'; // Company websites, portfolios, etc.
    } catch {
      return 'LOW'; // Malformed URL
    }
  }
}
