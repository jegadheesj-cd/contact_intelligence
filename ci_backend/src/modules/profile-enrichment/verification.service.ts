import logger from '../../config/logger';
import { stringSimilarity } from '../../utils/stringUtils';

export interface VerificationResult {
  isVerified: boolean;
  confidence: number;
  reasons: string[];
}

export class ProfileVerificationService {
  /**
   * Verifies that the discovered profile actually belongs to the OCR contact.
   */
  public verifyProfile(
    contact: {
      name: string;
      company: string | null;
      designation: string | null;
      location?: string | null;
    },
    discoveredProfile: {
      fullName: string;
      company: string;
      designation: string;
      location?: string;
    }
  ): VerificationResult {
    logger.info(`[Verification Agent] Starting strict verification for ${contact.name}`);

    let totalScore = 0;
    const reasons: string[] = [];

    // 1. Name Match (Crucial)
    const nameSim = stringSimilarity(contact.name, discoveredProfile.fullName);
    totalScore += nameSim * 0.5; // 50% weight
    reasons.push(`Name similarity: ${(nameSim * 100).toFixed(1)}%`);

    if (nameSim < 0.6) {
      logger.warn(`[Verification Agent] Name mismatch (${contact.name} vs ${discoveredProfile.fullName})`);
      return { isVerified: false, confidence: nameSim, reasons: [...reasons, 'Critical Name Mismatch'] };
    }

    // 2. Company Match (High weight)
    if (contact.company && discoveredProfile.company) {
      const compSim = stringSimilarity(contact.company, discoveredProfile.company);
      totalScore += compSim * 0.3; // 30% weight
      reasons.push(`Company similarity: ${(compSim * 100).toFixed(1)}%`);
    } else {
      totalScore += 0.15; // Neutral distribution if company unknown
      reasons.push(`Company not compared`);
    }

    // 3. Designation Match
    if (contact.designation && discoveredProfile.designation) {
      const desigSim = stringSimilarity(contact.designation, discoveredProfile.designation);
      totalScore += desigSim * 0.2; // 20% weight
      reasons.push(`Designation similarity: ${(desigSim * 100).toFixed(1)}%`);
    } else {
      totalScore += 0.1; // Neutral distribution if title unknown
      reasons.push(`Designation not compared`);
    }

    const confidence = Number(totalScore.toFixed(2));
    const VERIFICATION_THRESHOLD = 0.70;

    const isVerified = confidence >= VERIFICATION_THRESHOLD;

    logger.info(`[Verification Agent] Verification complete. Confidence: ${confidence} (Verified: ${isVerified})`);
    
    return {
      isVerified,
      confidence,
      reasons
    };
  }
}
