import axios from 'axios';
import logger from '../../../../config/logger';
import { CandidateProfile } from '../ProfileDiscoveryEngine';

export class PhantomBusterEnricher {
  private readonly apiKey: string;
  private readonly agentId: string;
  private readonly apiUrl = 'https://api.phantombuster.com/api/v2';

  constructor() {
    this.apiKey = process.env.PHANTOMBUSTER_API_KEY || '';
    this.agentId = process.env.PHANTOMBUSTER_AGENT_ID || '';
  }

  public isConfigured(): boolean {
    return !!(this.apiKey && this.agentId);
  }

  public async enrichProfile(linkedInUrl: string): Promise<CandidateProfile | null> {
    if (!this.isConfigured()) {
      logger.warn('[PhantomBusterEnricher] PhantomBuster API Key or Agent ID not configured. Skipping enrichment.');
      return null;
    }

    try {
      logger.info(`[PhantomBusterEnricher] Launching PhantomBuster scraper for ${linkedInUrl}`);
      
      // 1. Launch Agent
      const launchRes = await axios.post(
        `${this.apiUrl}/agents/launch`,
        {
          id: this.agentId,
          bonusArgument: {
            profileUrls: [linkedInUrl],
            spreadsheetUrl: linkedInUrl
          }
        },
        {
          headers: { 
            'x-phantombuster-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const containerId = launchRes.data.containerId;
      logger.info(`[PhantomBusterEnricher] Agent launched successfully. Container ID: ${containerId}`);

      // 2. Poll for completion (Max ~60 seconds)
      let attempts = 0;
      let outputUrl = null;
      
      while (attempts < 12) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5s interval
        
        const statusRes = await axios.get(`${this.apiUrl}/containers/fetch`, {
          params: { id: containerId },
          headers: { 'x-phantombuster-key': this.apiKey }
        });

        const status = statusRes.data.status;
        if (status === 'finished') {
          logger.info(`[PhantomBusterEnricher] Container finished. Fetching output logs...`);
          const outputRes = await axios.get(`${this.apiUrl}/containers/fetch-output`, {
            params: { id: containerId },
            headers: { 'x-phantombuster-key': this.apiKey }
          });
          
          if (outputRes.data.outputUrl) {
            outputUrl = outputRes.data.outputUrl;
          } else if (outputRes.data.resultObject) {
             return this.mapToCandidateProfile(outputRes.data.resultObject, linkedInUrl);
          }
          break;
        } else if (status === 'error' || status === 'canceled') {
          logger.error(`[PhantomBusterEnricher] Container failed or was canceled. Status: ${status}`);
          return null;
        }
        
        attempts++;
      }

      if (!outputUrl) {
        logger.warn('[PhantomBusterEnricher] Timeout waiting for PhantomBuster or no output URL returned.');
        return null;
      }

      // 3. Fetch JSON results from outputUrl
      const jsonRes = await axios.get(outputUrl);
      const data = jsonRes.data; 
      
      // Usually an array of scraped objects
      if (Array.isArray(data) && data.length > 0) {
        logger.info(`[PhantomBusterEnricher] Successfully fetched and parsed enriched data.`);
        return this.mapToCandidateProfile(data[0], linkedInUrl);
      }
      
      logger.warn('[PhantomBusterEnricher] PhantomBuster returned empty array or invalid format.');
      return null;
      
    } catch (error: any) {
      logger.error(`[PhantomBusterEnricher] Error during enrichment: ${error.message}`);
      return null;
    }
  }

  private mapToCandidateProfile(pbData: any, originalUrl: string): CandidateProfile {
    // Safely map PhantomBuster's JSON schema into our internal CandidateProfile model
    
    const experience = (pbData.jobs || pbData.experience || []).map((job: any) => ({
      title: job.jobTitle || job.title || 'Unknown Role',
      company: job.companyName || job.company || 'Unknown Company',
      period: job.dateRange || job.dates || job.duration || '',
      description: job.description || ''
    }));

    const education = (pbData.schools || pbData.education || []).map((edu: any) => ({
      school: edu.schoolName || edu.school || 'Unknown School',
      degree: edu.degreeName || edu.degree || '',
      year: edu.dateRange || edu.dates || edu.duration || '',
      fieldOfStudy: edu.fieldOfStudy || ''
    }));

    const skills = (pbData.skills || []).map((s: any) => {
      if (typeof s === 'string') return s;
      return s.name || s.skill || '';
    });

    const languages = (pbData.languages || []).map((l: any) => {
      if (typeof l === 'string') return l;
      return l.name || l.language || '';
    });

    const certifications = (pbData.certifications || []).map((c: any) => {
      if (typeof c === 'string') return c;
      return c.name || c.title || '';
    });

    return {
      fullName: pbData.fullName || (pbData.firstName ? `${pbData.firstName} ${pbData.lastName || ''}`.trim() : ''),
      headline: pbData.headline || pbData.jobTitle || '',
      company: pbData.companyName || pbData.company || pbData.currentCompany || '',
      designation: pbData.jobTitle || pbData.title || '',
      location: pbData.location || pbData.city || pbData.country || '',
      industry: pbData.industry || '',
      profileImage: pbData.profileImageUrl || pbData.imgUrl || pbData.avatar || '',
      summary: pbData.summary || pbData.about || '',
      experience,
      education,
      skills: skills.filter(Boolean),
      certifications: certifications.filter(Boolean),
      languages: languages.filter(Boolean),
      projects: [],
      publicProfiles: [
        {
          platform: 'LinkedIn',
          url: pbData.linkedInUrl || pbData.url || originalUrl,
          confidence: 100
        }
      ],
      source: 'PhantomBuster LinkedIn Data',
      sourceConfidence: 100, // Highest confidence since we directly scraped the verified URL
    };
  }
}
