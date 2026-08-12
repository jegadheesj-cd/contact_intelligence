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
            profileUrls: [linkedInUrl]
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

      // 2. Poll for completion (Max ~90 seconds)
      let attempts = 0;
      
      while (attempts < 18) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5s interval
        
        const statusRes = await axios.get(`${this.apiUrl}/containers/fetch`, {
          params: { id: containerId },
          headers: { 'x-phantombuster-key': this.apiKey }
        });

        const status = statusRes.data.status;
        logger.info(`[PhantomBusterEnricher] Container status check #${attempts + 1}: ${status}`);
        
        if (status === 'finished') {
          logger.info(`[PhantomBusterEnricher] Container finished. Fetching result data...`);
          
          // Strategy 1: Fetch structured result object from the container
          try {
            const resultRes = await axios.get(`${this.apiUrl}/containers/fetch-result-object`, {
              params: { id: containerId },
              headers: { 'x-phantombuster-key': this.apiKey }
            });
            logger.info(`[PhantomBusterEnricher] fetch-result-object response keys: ${JSON.stringify(Object.keys(resultRes.data || {}))}`);
            
            if (resultRes.data && resultRes.data.resultObject) {
              const resultObj = typeof resultRes.data.resultObject === 'string' 
                ? JSON.parse(resultRes.data.resultObject) 
                : resultRes.data.resultObject;
              
              if (Array.isArray(resultObj) && resultObj.length > 0) {
                logger.info(`[PhantomBusterEnricher] Got result object array with ${resultObj.length} items.`);
                return this.mapToCandidateProfile(resultObj[0], linkedInUrl);
              } else if (resultObj && typeof resultObj === 'object' && !Array.isArray(resultObj)) {
                logger.info(`[PhantomBusterEnricher] Got single result object.`);
                return this.mapToCandidateProfile(resultObj, linkedInUrl);
              }
            }
          } catch (e: any) {
            logger.warn(`[PhantomBusterEnricher] fetch-result-object failed: ${e.message}`);
          }

          // Strategy 2: Fetch agent-level output (result file URL)
          try {
            const agentOutputRes = await axios.get(`${this.apiUrl}/agents/fetch-output`, {
              params: { id: this.agentId },
              headers: { 'x-phantombuster-key': this.apiKey }
            });
            logger.info(`[PhantomBusterEnricher] agents/fetch-output response keys: ${JSON.stringify(Object.keys(agentOutputRes.data || {}))}`);
            
            const s3Folder = agentOutputRes.data.s3Folder;
            const resultObject = agentOutputRes.data.resultObject;
            const outputUrl = agentOutputRes.data.output;
            
            // Try resultObject first
            if (resultObject) {
              const parsed = typeof resultObject === 'string' ? JSON.parse(resultObject) : resultObject;
              if (Array.isArray(parsed) && parsed.length > 0) {
                logger.info(`[PhantomBusterEnricher] Got agent resultObject with ${parsed.length} items.`);
                return this.mapToCandidateProfile(parsed[0], linkedInUrl);
              } else if (parsed && typeof parsed === 'object') {
                return this.mapToCandidateProfile(parsed, linkedInUrl);
              }
            }
            
            // Try s3Folder for CSV/JSON result file
            if (s3Folder) {
              const resultFileUrl = `https://phantombuster.s3.amazonaws.com/${s3Folder}/result.json`;
              logger.info(`[PhantomBusterEnricher] Trying result file URL: ${resultFileUrl}`);
              try {
                const fileRes = await axios.get(resultFileUrl);
                if (Array.isArray(fileRes.data) && fileRes.data.length > 0) {
                  logger.info(`[PhantomBusterEnricher] Got result.json with ${fileRes.data.length} items.`);
                  return this.mapToCandidateProfile(fileRes.data[0], linkedInUrl);
                }
              } catch (fileErr: any) {
                // Try CSV fallback
                const csvUrl = `https://phantombuster.s3.amazonaws.com/${s3Folder}/result.csv`;
                logger.info(`[PhantomBusterEnricher] result.json not found. Trying: ${csvUrl}`);
                try {
                  const csvRes = await axios.get(csvUrl, { responseType: 'text' });
                  const csvData = this.parseSimpleCsv(csvRes.data);
                  if (csvData) {
                    logger.info(`[PhantomBusterEnricher] Parsed CSV result successfully.`);
                    return this.mapToCandidateProfile(csvData, linkedInUrl);
                  }
                } catch (csvErr: any) {
                  logger.warn(`[PhantomBusterEnricher] CSV fallback also failed: ${csvErr.message}`);
                }
              }
            }
          } catch (e: any) {
            logger.warn(`[PhantomBusterEnricher] agents/fetch-output failed: ${e.message}`);
          }

          // Strategy 3: Check container fetch-output for inline data
          try {
            const outputRes = await axios.get(`${this.apiUrl}/containers/fetch-output`, {
              params: { id: containerId },
              headers: { 'x-phantombuster-key': this.apiKey }
            });
            logger.info(`[PhantomBusterEnricher] containers/fetch-output keys: ${JSON.stringify(Object.keys(outputRes.data || {}))}`);
            
            if (outputRes.data.outputUrl) {
              const jsonRes = await axios.get(outputRes.data.outputUrl);
              if (Array.isArray(jsonRes.data) && jsonRes.data.length > 0) {
                return this.mapToCandidateProfile(jsonRes.data[0], linkedInUrl);
              }
            }
          } catch (e: any) {
            logger.warn(`[PhantomBusterEnricher] containers/fetch-output failed: ${e.message}`);
          }

          logger.warn('[PhantomBusterEnricher] Container finished but no usable result data found across all strategies.');
          return null;
        } else if (status === 'error' || status === 'canceled') {
          logger.error(`[PhantomBusterEnricher] Container failed or was canceled. Status: ${status}`);
          return null;
        }
        
        attempts++;
      }

      logger.warn('[PhantomBusterEnricher] Timeout waiting for PhantomBuster container to finish.');
      return null;
      
    } catch (error: any) {
      logger.error(`[PhantomBusterEnricher] Error during enrichment: ${error.message}`);
      return null;
    }
  }

  /**
   * Simple CSV parser for PhantomBuster result files.
   * Returns the first row as a key-value object using header row as keys.
   */
  private parseSimpleCsv(csvText: string): Record<string, any> | null {
    try {
      const lines = csvText.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) return null;
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const values = lines[1].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      const obj: Record<string, any> = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = values[i] || '';
      }
      return obj;
    } catch {
      return null;
    }
  }

  private mapToCandidateProfile(pbData: any, originalUrl: string): CandidateProfile {
    // Safely map PhantomBuster's JSON schema into our internal CandidateProfile model
    
    const experience = (pbData.jobs || pbData.experience || []).map((job: any) => {
      const period = job.dateRange || job.dates || job.duration || '';
      const isCurrent = job.isCurrent || /present|current/i.test(period) || /present/i.test(job.endDate || '');
      
      let startDate = job.startDate || '';
      let endDate = job.endDate || '';
      if (period && (!startDate || !endDate)) {
        const parts = period.split(/[–\-\—\to]/);
        if (parts.length > 0 && !startDate) startDate = parts[0].trim();
        if (parts.length > 1 && !endDate) endDate = parts[1].trim();
      }

      return {
        title: job.jobTitle || job.title || 'Unknown Role',
        company: job.companyName || job.company || 'Unknown Company',
        companyLogo: job.companyLogoUrl || job.companyLogo || job.logoUrl || job.logo || job.logo_url || '',
        period,
        startDate,
        endDate,
        isCurrent: !!isCurrent,
        duration: job.duration || job.durationString || '',
        location: job.location || '',
        description: job.description || '',
        skills: Array.isArray(job.skills) ? job.skills : (typeof job.skills === 'string' ? job.skills.split(',').map((s: string) => s.trim()) : [])
      };
    });

    const education = (pbData.schools || pbData.education || []).map((edu: any) => {
      const year = edu.dateRange || edu.dates || edu.duration || edu.year || '';
      
      let startDate = edu.startDate || '';
      let endDate = edu.endDate || '';
      if (year && (!startDate || !endDate)) {
        const parts = year.split(/[–\-\—\to]/);
        if (parts.length > 0 && !startDate) startDate = parts[0].trim();
        if (parts.length > 1 && !endDate) endDate = parts[1].trim();
      }

      return {
        school: edu.schoolName || edu.school || 'Unknown School',
        degree: edu.degreeName || edu.degree || '',
        year,
        startDate,
        endDate,
        fieldOfStudy: edu.fieldOfStudy || '',
        description: edu.description || '',
        activities: edu.activities || edu.activitiesAndSocieties || ''
      };
    });

    const volunteerExperience = (pbData.volunteerExperiences || pbData.volunteerExperience || pbData.volunteering || pbData.volunteer || []).map((vol: any) => {
      if (typeof vol === 'string') {
        return { name: vol, role: '', period: '', description: '' };
      }
      return {
        name: vol.companyName || vol.company || vol.organization || vol.name || 'Unknown Organization',
        role: vol.role || vol.title || '',
        period: vol.dateRange || vol.dates || vol.period || '',
        description: vol.description || ''
      };
    });

    const organizations = (pbData.organizations || pbData.associations || pbData.clubs || pbData.groups || []).map((org: any) => {
      if (typeof org === 'string') {
        return { name: org, role: '', period: '', description: '' };
      }
      return {
        name: org.name || org.organizationName || org.company || 'Unknown Organization',
        role: org.role || org.position || org.title || '',
        period: org.dateRange || org.dates || org.period || '',
        description: org.description || ''
      };
    });

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
      organizations,
      volunteerExperience,
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
