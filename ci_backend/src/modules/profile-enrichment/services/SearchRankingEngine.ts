import logger from '../../../config/logger';
import { CandidateProfile } from './ProfileDiscoveryEngine';
import { IdentitySignals } from './IdentityResolver';
import { stringSimilarity } from '../../../utils/stringUtils';

export class SearchRankingEngine {
  /**
   * Ranks all discovered candidate profiles independently.
   * Calculates a relevance score (confidence) representing the likelihood
   * that the discovered profile belongs to the uploaded business card.
   * Ensures no identical confidence values exist.
   */
  public rankCandidates(signals: IdentitySignals, candidates: CandidateProfile[]): CandidateProfile[] {
    logger.info(`[SearchRankingEngine] Ranking ${candidates.length} discovered candidate profiles...`);

    const getEmailDomain = (emailStr: string | null | undefined): string | null => {
      if (!emailStr) return null;
      const parts = emailStr.toLowerCase().split('@');
      if (parts.length < 2) return null;
      const domain = parts[1];
      const ignored = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com'];
      return ignored.includes(domain) ? null : domain;
    };

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

    const ocrDomain = getEmailDomain(signals.email);
    const ocrWebDomain = getWebsiteDomain(signals.website);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      let confidence = 0;
      const reasons: string[] = [];

      const candidateStr = JSON.stringify(candidate).toLowerCase();

      // --- Highest Weight (Up to 45%) ---
      // 1. Exact Name Match (20%)
      const nameSim = stringSimilarity(signals.name.toLowerCase(), candidate.fullName.toLowerCase());
      if (nameSim > 0.85) {
        confidence += 20;
        reasons.push('Highest Weight: Exact Name Match');
      } else if (nameSim > 0.6) {
        confidence += 10;
        reasons.push('Partial Name Match');
      }

      // 2. Email Match (10%)
      let hasEmailMatch = false;
      if (signals.email && candidateStr.includes(signals.email.toLowerCase())) {
        confidence += 10;
        hasEmailMatch = true;
        reasons.push('Highest Weight: Email Match');
      }

      // 3. Phone Match (10%)
      if (signals.phone && candidateStr.includes(signals.phone.replace(/[^0-9]/g, ''))) {
        confidence += 10;
        reasons.push('Highest Weight: Phone Match');
      }

      // 4. Email Domain Match (5%)
      if (ocrDomain && !hasEmailMatch) {
        if ((candidate.company && candidate.company.toLowerCase().includes(ocrDomain.split('.')[0])) ||
            candidate.publicProfiles.some(p => p.url.toLowerCase().includes(ocrDomain))) {
          confidence += 5;
          reasons.push('Highest Weight: Email Domain Match');
        }
      }

      // --- High Weight (Up to 25%) ---
      // 5. Company Match (15%)
      if (signals.company) {
        let bestCompSim = 0;
        if (candidate.company) bestCompSim = stringSimilarity(signals.company.toLowerCase(), candidate.company.toLowerCase());
        const signalCompany = signals.company;
        candidate.experience.forEach(exp => {
          if (exp.company) bestCompSim = Math.max(bestCompSim, stringSimilarity(signalCompany.toLowerCase(), exp.company.toLowerCase()));
        });
        if (bestCompSim > 0.8) {
          confidence += 15;
          reasons.push('High Weight: Company Match');
        } else if (bestCompSim > 0.5) {
          confidence += 7;
        }
      }

      // 6. Company Website Match (10%)
      if (ocrWebDomain) {
        if (candidate.publicProfiles.some(p => getWebsiteDomain(p.url) === ocrWebDomain) || candidate.companyBio) {
          confidence += 10;
          reasons.push('High Weight: Company Website Match');
        }
      }

      // --- Medium Weight (Up to 20%) ---
      // 7. Username Similarity (5%)
      if (signals.email) {
        const emailPrefix = signals.email.split('@')[0].toLowerCase();
        const usernames = candidate.publicProfiles.map(p => {
          const match = p.url.match(/([^\/]+)\/?$/);
          return match ? match[1].split('?')[0].toLowerCase() : '';
        }).filter(Boolean);
        if (usernames.some(u => u.includes(emailPrefix) || emailPrefix.includes(u))) {
          confidence += 5;
          reasons.push('Medium Weight: Username Similarity');
        }
      }

      // 8. Website Match (Generic / Portfolio) (5%)
      if (candidate.source === 'Portfolio Scraper') {
        confidence += 5;
        reasons.push('Medium Weight: Website Match (Portfolio)');
      }

      // 9. Location Match (5%)
      if (signals.address && candidate.location) {
        if (stringSimilarity(signals.address.toLowerCase(), candidate.location.toLowerCase()) > 0.5) {
          confidence += 5;
          reasons.push('Medium Weight: Location Match');
        }
      }

      // 10. Cross Platform References (5%)
      if (candidate.publicProfiles.length > 1) {
        confidence += 5;
        reasons.push('Medium Weight: Cross Platform References');
      }

      // --- Low Weight (Up to 5%) ---
      // 11. Designation Similarity (5%)
      if (signals.designation) {
        let bestDesigSim = 0;
        if (candidate.designation) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(signals.designation.toLowerCase(), candidate.designation.toLowerCase()));
        if (candidate.headline) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(signals.designation.toLowerCase(), candidate.headline.toLowerCase()));
        if (bestDesigSim > 0.6) {
          confidence += 5;
          reasons.push('Low Weight: Designation Similarity');
        }
      }

      // --- CRITICAL PENALTY ---
      // If the name is completely different, cap the confidence to prevent false positives
      // (e.g. colleagues at the same company sharing the same domain/website)
      const nameParts1 = signals.name.toLowerCase().split(/[\s,]+/);
      const nameParts2 = candidate.fullName.toLowerCase().split(/[\s,]+/);
      const hasSignificantOverlap = nameParts1.some(p1 => 
        p1.length >= 4 && nameParts2.some(p2 => p2.includes(p1) || p1.includes(p2))
      );
      if (nameSim < 0.45 && !hasSignificantOverlap) {
        confidence = Math.min(confidence, 30);
        reasons.push('Penalty: Severe Name Mismatch');
      }

      // Never assign identical confidence values.
      // We add a tiny tie-breaker based on the index to ensure uniqueness if ties occur.
      const tieBreaker = (candidates.length - i) * 0.0001; 
      
      // Cap at 99.9% max and at least 1% for any discovered profile
      confidence = Math.max(1, Math.min(confidence, 99.9));
      confidence = confidence + tieBreaker;

      // Update candidate confidence
      candidate.sourceConfidence = Number(confidence.toFixed(4));
      candidate.verificationStatus = candidate.sourceConfidence >= 70 ? 'Verified' : 'Unverified';
      (candidate as any).verificationReasons = reasons;

      // Update nested public profiles confidence
      if (candidate.publicProfiles.length > 0) {
        candidate.publicProfiles[0].confidence = candidate.sourceConfidence;
        candidate.publicProfiles[0].reasons = reasons;
      }
    }

    // Sort candidates descending by confidence
    candidates.sort((a, b) => b.sourceConfidence - a.sourceConfidence);
    return candidates;
  }
}
