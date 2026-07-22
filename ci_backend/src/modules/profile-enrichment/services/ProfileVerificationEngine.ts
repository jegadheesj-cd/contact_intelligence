import { stringSimilarity } from '../../../utils/stringUtils';
import logger from '../../../config/logger';
import { CandidateProfile } from './ProfileDiscoveryEngine';

export interface VerificationResult {
  isVerified: boolean;
  confidence: number;
  reasons: string[];
}

export class ProfileVerificationEngine {
  /**
   * Verifies that the discovered candidate profile matches the target OCR contact.
   * Uses weighted identity matching:
   * - Email: 25%
   * - Phone: 20%
   * - Company: 15%
   * - Website Domain: 15%
   * - Designation: 12%
   * - Name: 10%
   * - Location: 3%
   */
  public verify(
    ocrContact: {
      name: string;
      company?: string | null;
      designation?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      address?: string | null;
    },
    candidate: CandidateProfile
  ): VerificationResult {
    logger.info(`[ProfileVerificationEngine] Running weighted matching verification for: ${candidate.fullName}`);
    
    let totalScore = 0;
    const reasons: string[] = [];

    // Helper to extract email domain
    const getEmailDomain = (emailStr: string | null | undefined): string | null => {
      if (!emailStr) return null;
      const parts = emailStr.toLowerCase().split('@');
      if (parts.length < 2) return null;
      const domain = parts[1];
      const ignored = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com'];
      return ignored.includes(domain) ? null : domain;
    };

    // Helper to extract website domain
    const getWebsiteDomain = (urlStr: string | null | undefined): string | null => {
      if (!urlStr) return null;
      try {
        let host = urlStr.toLowerCase();
        if (!host.startsWith('http://') && !host.startsWith('https://')) {
          host = 'https://' + host;
        }
        const parsed = new URL(host);
        let hostname = parsed.hostname;
        if (hostname.startsWith('www.')) hostname = hostname.substring(4);
        return hostname;
      } catch (e) {
        return null;
      }
    };

    // 1. Name Match (Weight: 10)
    const nameSim = stringSimilarity(ocrContact.name.toLowerCase(), candidate.fullName.toLowerCase());
    const namePoints = Math.round(nameSim * 10 * 10) / 10;
    totalScore += namePoints;
    reasons.push(`Name Match: ${(nameSim * 100).toFixed(0)}% (weighted: ${namePoints}/10)`);

    // 2. Email Match / Email Domain Match (Weight: 25)
    if (ocrContact.email) {
      let emailPoints = 0;
      const ocrDomain = getEmailDomain(ocrContact.email);
      
      // If we have a direct email in candidate profile and it matches
      if (candidate.publicProfiles.some(p => p.url.toLowerCase().includes(ocrContact.email!.toLowerCase()))) {
        emailPoints = 25;
        reasons.push(`Email Match: Direct email match found in public profile URL (weighted: 25/25)`);
      } else if (ocrDomain && candidate.company && candidate.company.toLowerCase().includes(ocrDomain.split('.')[0])) {
        emailPoints = 20;
        reasons.push(`Email Match: Domain "${ocrDomain}" aligns with candidate company "${candidate.company}" (weighted: 20/25)`);
      } else {
        emailPoints = 5; // Neutral partial for having email
        reasons.push(`Email Match: No direct match, email domain mismatch (weighted: 5/25)`);
      }
      totalScore += emailPoints;
    } else {
      totalScore += 12; // Neutral average score when ocr does not have email
      reasons.push(`Email Match: Email not present in OCR (+12 neutral)`);
    }

    // 3. Phone Match (Weight: 20)
    if (ocrContact.phone) {
      let phonePoints = 0;
      const cleanOcrPhone = ocrContact.phone.replace(/\D/g, '');
      
      // Check if phone matches any public profiles/text/stubs
      if (candidate.publicProfiles.some(p => p.url.includes(cleanOcrPhone)) || (candidate.headline && candidate.headline.includes(cleanOcrPhone))) {
        phonePoints = 20;
        reasons.push(`Phone Match: Direct phone match found (weighted: 20/20)`);
      } else {
        phonePoints = 5;
        reasons.push(`Phone Match: No phone number match (weighted: 5/20)`);
      }
      totalScore += phonePoints;
    } else {
      totalScore += 10; // Neutral average score when ocr does not have phone
      reasons.push(`Phone Match: Phone not present in OCR (+10 neutral)`);
    }

    // 4. Company Match (Weight: 15)
    if (ocrContact.company) {
      let bestCompSim = 0;
      if (candidate.company) {
        bestCompSim = Math.max(bestCompSim, stringSimilarity(ocrContact.company.toLowerCase(), candidate.company.toLowerCase()));
      }
      if (candidate.experience && candidate.experience.length > 0) {
        for (const exp of candidate.experience) {
          if (exp.company) {
            bestCompSim = Math.max(bestCompSim, stringSimilarity(ocrContact.company.toLowerCase(), exp.company.toLowerCase()));
          }
        }
      }
      const compPoints = Math.round(bestCompSim * 15 * 10) / 10;
      totalScore += compPoints;
      reasons.push(`Company Match: ${(bestCompSim * 100).toFixed(0)}% (weighted: ${compPoints}/15)`);
    } else {
      totalScore += 7;
      reasons.push(`Company Match: Company not present in OCR (+7 neutral)`);
    }

    // 5. Website Domain Match (Weight: 15)
    if (ocrContact.website) {
      let webPoints = 0;
      const ocrWebDomain = getWebsiteDomain(ocrContact.website);
      const candidateWebDomain = candidate.publicProfiles.length > 0 ? getWebsiteDomain(candidate.publicProfiles[0].url) : null;
      
      if (ocrWebDomain && candidateWebDomain && ocrWebDomain === candidateWebDomain) {
        webPoints = 15;
        reasons.push(`Website Match: Perfect website domain match "${ocrWebDomain}" (weighted: 15/15)`);
      } else if (ocrWebDomain && candidate.company && candidate.company.toLowerCase().includes(ocrWebDomain.split('.')[0])) {
        webPoints = 12;
        reasons.push(`Website Match: Domain "${ocrWebDomain}" matches company name "${candidate.company}" (weighted: 12/15)`);
      } else {
        webPoints = 5;
        reasons.push(`Website Match: No website alignment (weighted: 5/15)`);
      }
      totalScore += webPoints;
    } else {
      totalScore += 7;
      reasons.push(`Website Match: Website not present in OCR (+7 neutral)`);
    }

    // 6. Designation Match (Weight: 12)
    if (ocrContact.designation) {
      let bestDesigSim = 0;
      if (candidate.designation) {
        bestDesigSim = Math.max(bestDesigSim, stringSimilarity(ocrContact.designation.toLowerCase(), candidate.designation.toLowerCase()));
      }
      if (candidate.headline) {
        bestDesigSim = Math.max(bestDesigSim, stringSimilarity(ocrContact.designation.toLowerCase(), candidate.headline.toLowerCase()));
      }
      const desigPoints = Math.round(bestDesigSim * 12 * 10) / 10;
      totalScore += desigPoints;
      reasons.push(`Designation Match: ${(bestDesigSim * 100).toFixed(0)}% (weighted: ${desigPoints}/12)`);
    } else {
      totalScore += 6;
      reasons.push(`Designation Match: Designation not present in OCR (+6 neutral)`);
    }

    // 7. Location Match (Weight: 3)
    if (ocrContact.address) {
      let locSim = 0;
      if (candidate.location) {
        locSim = stringSimilarity(ocrContact.address.toLowerCase(), candidate.location.toLowerCase());
      }
      const locPoints = Math.round(locSim * 3 * 10) / 10;
      totalScore += locPoints;
      reasons.push(`Location Match: ${(locSim * 100).toFixed(0)}% (weighted: ${locPoints}/3)`);
    } else {
      totalScore += 1.5;
      reasons.push(`Location Match: Location not present in OCR (+1.5 neutral)`);
    }

    const finalScore = Math.min(Math.round(totalScore), 100);
    logger.info(`[ProfileVerificationEngine] Final verification score: ${finalScore}%`);

    return {
      isVerified: finalScore >= 70,
      confidence: finalScore,
      reasons,
    };
  }
}
