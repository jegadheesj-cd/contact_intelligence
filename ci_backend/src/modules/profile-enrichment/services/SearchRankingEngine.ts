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
      const matchedSignals: string[] = [];
      const missingSignals: string[] = [];
      const penalties: string[] = [];

      const candidateStr = JSON.stringify(candidate).toLowerCase();
      const platform = candidate.publicProfiles[0]?.platform || 'Unknown';
      const url = candidate.publicProfiles[0]?.url || 'Unknown';

      // --- POSITIVE SIGNALS ---
      // 1. Full Name Similarity (+35)
      const nameSim = stringSimilarity(signals.name.toLowerCase(), candidate.fullName.toLowerCase());
      let hasNameMatch = false;
      if (nameSim > 0.8) {
        confidence += 35;
        hasNameMatch = true;
        matchedSignals.push('Full Name');
        reasons.push('Full Name Similarity: +35');
      } else if (nameSim > 0.5) {
        confidence += 15;
        matchedSignals.push('Partial Name');
        reasons.push('Partial Name Similarity: +15');
      } else {
        missingSignals.push('Full Name not matched');
      }

      // 2. Company Match (+25)
      let hasCompanyMatch = false;
      if (signals.company) {
        let bestCompSim = 0;
        if (candidate.company) bestCompSim = stringSimilarity(signals.company.toLowerCase(), candidate.company.toLowerCase());
        candidate.experience.forEach(exp => {
          if (exp.company) bestCompSim = Math.max(bestCompSim, stringSimilarity(signals.company!.toLowerCase(), exp.company.toLowerCase()));
        });
        if (bestCompSim > 0.7) {
          confidence += 25;
          hasCompanyMatch = true;
          matchedSignals.push('Company');
          reasons.push('Company Match: +25');
        } else if (bestCompSim > 0.4) {
          confidence += 10;
          matchedSignals.push('Partial Company');
          reasons.push('Partial Company Match: +10');
        } else {
          missingSignals.push('Company mismatch');
        }
      }

      // 3. Designation Match (+15)
      if (signals.designation) {
        let bestDesigSim = 0;
        if (candidate.designation) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(signals.designation.toLowerCase(), candidate.designation.toLowerCase()));
        if (candidate.headline) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(signals.designation.toLowerCase(), candidate.headline.toLowerCase()));
        if (bestDesigSim > 0.6) {
          confidence += 15;
          matchedSignals.push('Designation');
          reasons.push('Designation Match: +15');
        } else {
          missingSignals.push('Designation not matched');
        }
      }

      // 4. Username Similarity (+10)
      if (signals.email) {
        const emailPrefix = signals.email.split('@')[0].toLowerCase();
        if (url.toLowerCase().includes(emailPrefix)) {
          confidence += 10;
          matchedSignals.push('Username');
          reasons.push('Username Similarity: +10');
        } else {
          missingSignals.push('Email/Username not found in URL');
        }
      }

      // 5. Company Website Match (+10)
      if (ocrWebDomain) {
        if (url.toLowerCase().includes(ocrWebDomain)) {
          confidence += 10;
          matchedSignals.push('Website Domain');
          reasons.push('Company Website Match: +10');
        } else {
          missingSignals.push('Website Domain not matched');
        }
      }

      // 6. Email Domain (+5)
      if (ocrDomain && candidateStr.includes(ocrDomain)) {
        confidence += 5;
        matchedSignals.push('Email Domain');
        reasons.push('Email Domain Match: +5');
      }

      // 7. Cross Platform References (+5)
      if (candidate.publicProfiles.length > 1) {
        confidence += 5;
        matchedSignals.push('Cross-platform Reference');
        reasons.push('Cross Platform References: +5');
      }

      // 8. Official Employee Page (+10)
      if (platform === 'Company Website' && (url.includes('/team') || url.includes('/about') || url.includes('/leadership') || candidate.companyRole)) {
        confidence += 10;
        matchedSignals.push('Employee Page');
        reasons.push('Official Employee Page: +10');
      }

      // 9. Portfolio Ownership (+10)
      if (platform === 'Portfolio' || candidate.source === 'Portfolio Scraper') {
        confidence += 10;
        matchedSignals.push('Portfolio');
        reasons.push('Portfolio Ownership: +10');
      }

      // 10. Professional Bio Similarity (+5)
      if (candidate.summary && candidate.summary.length > 50) {
        confidence += 5;
        matchedSignals.push('Professional Bio');
        reasons.push('Professional Bio Similarity: +5');
      }

      // --- NEGATIVE SIGNALS ---
      // 1. Wrong Person (-50)
      if (!hasNameMatch && nameSim < 0.3 && platform !== 'Company Website') {
        confidence -= 50;
        penalties.push('Wrong Person (-50)');
        reasons.push('Wrong Person: -50');
      }

      // 2. Wrong Company (-40)
      if (signals.company && !hasCompanyMatch && candidate.company) {
        // If candidate clearly belongs to another company, penalize
        confidence -= 40;
        penalties.push('Wrong Company (-40)');
        reasons.push('Wrong Company: -40');
      }

      // 3. Organization Homepage (-30)
      // (No longer applied to Company Website as it is intended to be the homepage)
      if (platform !== 'Company Website' && (url.endsWith('/') || url.split('/').length <= 3)) {
        confidence -= 30;
        penalties.push('Organization Homepage (-30)');
        reasons.push('Organization Homepage: -30');
      }

      // 4. Generic Company Page (-30)
      // (No longer applied to Company Website as it is intended to be the homepage)
      if (platform !== 'Company Website' && url.includes('/contact') && !hasNameMatch) {
        confidence -= 30;
        penalties.push('Generic Company Page (-30)');
        reasons.push('Generic Company Page: -30');
      }

      // 5. Directory Page (-20)
      if (url.includes('/directory') || url.includes('/list') || url.includes('zoominfo.com')) {
        confidence -= 20;
        penalties.push('Directory Page (-20)');
        reasons.push('Directory Page: -20');
      }

      // 6. Missing Identity Signals (-10)
      if (!candidate.company && !candidate.designation && !candidate.summary) {
        confidence -= 10;
        penalties.push('Missing Identity Signals (-10)');
        reasons.push('Missing Identity Signals: -10');
      }

      // Boost for official Company Website
      if (platform === 'Company Website' && hasCompanyMatch) {
        confidence += 60;
        reasons.push('Official Company Website Boost: +60');
      }

      // Cap at 99.9% max and at least 1% for any discovered profile
      confidence = Math.max(1, Math.min(confidence, 99.9));

      // Tie breaker
      const tieBreaker = (candidates.length - i) * 0.0001; 
      confidence = confidence + tieBreaker;
      
      const finalConfidence = Number(confidence.toFixed(4));
      candidate.sourceConfidence = finalConfidence;

      // Verification Status logic
      if (hasNameMatch && hasCompanyMatch && finalConfidence >= 90) {
        candidate.verificationStatus = 'VERIFIED';
      } else {
        candidate.verificationStatus = `Likely Match ${Math.floor(finalConfidence)}%`;
      }

      (candidate as any).verificationReasons = reasons;

      if (candidate.publicProfiles.length > 0) {
        candidate.publicProfiles[0].confidence = finalConfidence;
        candidate.publicProfiles[0].reasons = reasons;
      }

      candidate.explainability = {
        confidence: Math.floor(finalConfidence),
        matchedSignals,
        missingSignals,
        penalties,
        verification: candidate.verificationStatus
      };

      // Runtime Debugging Log
      logger.info(`--- CANDIDATE EVALUATION ---`);
      logger.info(`Platform: ${platform}`);
      logger.info(`URL: ${url}`);
      logger.info(`Name: ${candidate.fullName}`);
      logger.info(`Explainability: ${JSON.stringify(candidate.explainability)}`);
      logger.info(`----------------------------`);
    }

    // Sort candidates descending by confidence
    candidates.sort((a, b) => b.sourceConfidence - a.sourceConfidence);
    return candidates;
  }
}
