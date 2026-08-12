export interface VerifiedField<T> {
  value: T;
  source: string;
  confidence: number;
  timestamp: string;
  verification: 'Verified' | 'Unverified';
}

export interface MergedProfile {
  fullName: VerifiedField<string>;
  headline?: VerifiedField<string>;
  company?: VerifiedField<string>;
  designation?: VerifiedField<string>;
  location?: VerifiedField<string>;
  industry?: VerifiedField<string>;
  profileImage?: VerifiedField<string>;
  summary?: VerifiedField<string>;
  experience: VerifiedField<Array<{ 
    title: string; 
    company: string; 
    companyLogo?: string; 
    period: string; 
    startDate?: string; 
    endDate?: string; 
    isCurrent?: boolean; 
    duration?: string; 
    location?: string; 
    description?: string; 
    skills?: string[]; 
  }>>;
  education: VerifiedField<Array<{ 
    school: string; 
    degree?: string; 
    year?: string; 
    startDate?: string; 
    endDate?: string; 
    fieldOfStudy?: string; 
    description?: string; 
    activities?: string; 
  }>>;
  skills: VerifiedField<string[]>;
  projects: VerifiedField<Array<{ name: string; description: string; technologies?: string[]; duration?: string }>>;
  certifications?: VerifiedField<string[]>;
  achievements?: VerifiedField<string[]>;
  organizations?: VerifiedField<Array<{ 
    name: string; 
    role?: string; 
    period?: string; 
    description?: string; 
  }>>;
  volunteerExperience?: VerifiedField<Array<{ 
    name: string; 
    role?: string; 
    period?: string; 
    description?: string; 
  }>>;
  publications?: VerifiedField<string[]>;
  languages?: VerifiedField<string[]>;
  interests?: VerifiedField<string[]>;
  publicProfiles: VerifiedField<Array<{ platform: string; url: string; confidence?: number; reasons?: string[] }>>;
  // GitHub-specific
  repositories?: VerifiedField<Array<{ name: string; description: string; language: string; stars: number; forks: number; url: string; topics?: string[] }>>;
  pinnedRepositories?: VerifiedField<Array<{ name: string; description: string; language: string; stars: number; url: string }>>;
  primaryLanguages?: VerifiedField<string[]>;
  technologies?: VerifiedField<string[]>;
  githubStats?: VerifiedField<{ followers: number; following: number; publicRepos: number; login: string }>;
  // Company Website specific
  companyBio?: VerifiedField<string>;
  companyRole?: VerifiedField<string>;
  companyDepartment?: VerifiedField<string>;
  companyPhotoUrl?: VerifiedField<string>;
  [key: string]: any;
}

export interface ProviderResponse {
  sourceName: string;
  confidence: number;
  data: any;
  verificationStatus?: string;
}

export class ProfileMergeService {
  /**
   * Merges data from multiple provider responses into one unified profile.
   * Higher confidence providers take precedence for singular fields. Arrays are merged.
   * Every field conforms to: { value, source, confidence, timestamp, verification }
   */
  public mergeProfiles(providerResponses: ProviderResponse[]): { mergedProfile: MergedProfile; sourceAttribution: Record<string, any> } {
    const timestamp = new Date().toISOString();
    
    // Default initial empty profile structure
    const mergedProfile: any = {
      fullName: { value: '', source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      experience: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      education: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      skills: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      projects: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      publicProfiles: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      certifications: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      achievements: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      organizations: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      volunteerExperience: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      languages: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      interests: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      repositories: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      pinnedRepositories: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      primaryLanguages: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      technologies: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      scrapeCreatorsData: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' }
    };

    const sourceAttribution: Record<string, any> = {};

    // Sort responses by confidence descending
    const sortedResponses = [...providerResponses].sort((a, b) => b.confidence - a.confidence);

    for (const response of sortedResponses) {
      if (!response.data) continue;

      const verification = (response.data.verificationStatus === 'Verified' || response.confidence >= 70) ? 'Verified' : 'Unverified';

      // 1. Singular string fields
      const singularFields = [
        'fullName', 'headline', 'company', 'designation', 'location',
        'industry', 'profileImage', 'summary',
        'companyBio', 'companyRole', 'companyDepartment', 'companyPhotoUrl'
      ];
      for (const field of singularFields) {
        if (response.data[field]) {
          // If empty or if we are overwriting from a higher-confidence source
          if (!mergedProfile[field] || !mergedProfile[field].value) {
            mergedProfile[field] = {
              value: response.data[field],
              source: response.sourceName,
              confidence: response.confidence,
              timestamp,
              verification
            };
            sourceAttribution[field] = mergedProfile[field];
          }
        }
      }

      // 2. Objects (githubStats)
      if (response.data.githubStats) {
        if (!mergedProfile.githubStats || !mergedProfile.githubStats.value) {
          mergedProfile.githubStats = {
            value: response.data.githubStats,
            source: response.sourceName,
            confidence: response.confidence,
            timestamp,
            verification
          };
          sourceAttribution.githubStats = mergedProfile.githubStats;
        }
      }

      // 3. Structured Arrays (take from highest confidence source that has entries)
      const arrayFields = ['projects', 'repositories', 'pinnedRepositories'];
      for (const field of arrayFields) {
        if (response.data[field] && Array.isArray(response.data[field]) && response.data[field].length > 0) {
          if (!mergedProfile[field] || mergedProfile[field].value.length === 0) {
            mergedProfile[field] = {
              value: response.data[field],
              source: response.sourceName,
              confidence: response.confidence,
              timestamp,
              verification
            };
            sourceAttribution[field] = mergedProfile[field];
          }
        }
      }

      // 3.5. Merged and Deduplicated Arrays (Experience, Education, Organizations, Volunteering)
      if (response.data.experience && Array.isArray(response.data.experience) && response.data.experience.length > 0) {
        const currentExp = mergedProfile.experience.value || [];
        const updatedExp = [...currentExp];
        let addedNew = false;

        for (const exp of response.data.experience) {
          const compClean = (exp.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const titleClean = (exp.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const periodClean = (exp.period || exp.startDate || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          const isDuplicate = updatedExp.some((existing: any) => {
            const eCompClean = (existing.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const eTitleClean = (existing.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const ePeriodClean = (existing.period || existing.startDate || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return eCompClean === compClean && eTitleClean === titleClean && (ePeriodClean === periodClean || !ePeriodClean || !periodClean);
          });

          if (!isDuplicate) {
            updatedExp.push(exp);
            addedNew = true;
          }
        }

        if (addedNew || (updatedExp.length > 0 && currentExp.length === 0)) {
          mergedProfile.experience = {
            value: updatedExp,
            source: mergedProfile.experience.source === 'None' ? response.sourceName : mergedProfile.experience.source,
            confidence: mergedProfile.experience.confidence === 0 ? response.confidence : mergedProfile.experience.confidence,
            timestamp,
            verification: mergedProfile.experience.verification === 'Unverified' ? verification : mergedProfile.experience.verification
          };
          sourceAttribution.experience = mergedProfile.experience;
        }
      }

      if (response.data.education && Array.isArray(response.data.education) && response.data.education.length > 0) {
        const currentEdu = mergedProfile.education.value || [];
        const updatedEdu = [...currentEdu];
        let addedNew = false;

        for (const edu of response.data.education) {
          const schoolClean = (edu.school || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const degreeClean = (edu.degree || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const yearClean = (edu.year || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          const isDuplicate = updatedEdu.some((existing: any) => {
            const eSchoolClean = (existing.school || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const eDegreeClean = (existing.degree || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const eYearClean = (existing.year || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return eSchoolClean === schoolClean && (eDegreeClean === degreeClean || !eDegreeClean || !degreeClean) && (eYearClean === yearClean || !eYearClean || !yearClean);
          });

          if (!isDuplicate) {
            updatedEdu.push(edu);
            addedNew = true;
          }
        }

        if (addedNew || (updatedEdu.length > 0 && currentEdu.length === 0)) {
          mergedProfile.education = {
            value: updatedEdu,
            source: mergedProfile.education.source === 'None' ? response.sourceName : mergedProfile.education.source,
            confidence: mergedProfile.education.confidence === 0 ? response.confidence : mergedProfile.education.confidence,
            timestamp,
            verification: mergedProfile.education.verification === 'Unverified' ? verification : mergedProfile.education.verification
          };
          sourceAttribution.education = mergedProfile.education;
        }
      }

      if (response.data.organizations && Array.isArray(response.data.organizations) && response.data.organizations.length > 0) {
        const currentOrg = mergedProfile.organizations.value || [];
        const updatedOrg = [...currentOrg];
        let addedNew = false;

        for (const org of response.data.organizations) {
          const nameClean = (org.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const roleClean = (org.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          const isDuplicate = updatedOrg.some((existing: any) => {
            const eNameClean = (existing.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const eRoleClean = (existing.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return eNameClean === nameClean && (eRoleClean === roleClean || !eRoleClean || !roleClean);
          });

          if (!isDuplicate) {
            updatedOrg.push(org);
            addedNew = true;
          }
        }

        if (addedNew || (updatedOrg.length > 0 && currentOrg.length === 0)) {
          mergedProfile.organizations = {
            value: updatedOrg,
            source: mergedProfile.organizations.source === 'None' ? response.sourceName : mergedProfile.organizations.source,
            confidence: mergedProfile.organizations.confidence === 0 ? response.confidence : mergedProfile.organizations.confidence,
            timestamp,
            verification: mergedProfile.organizations.verification === 'Unverified' ? verification : mergedProfile.organizations.verification
          };
          sourceAttribution.organizations = mergedProfile.organizations;
        }
      }

      if (response.data.volunteerExperience && Array.isArray(response.data.volunteerExperience) && response.data.volunteerExperience.length > 0) {
        const currentVol = mergedProfile.volunteerExperience.value || [];
        const updatedVol = [...currentVol];
        let addedNew = false;

        for (const vol of response.data.volunteerExperience) {
          const nameClean = (vol.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const roleClean = (vol.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          const isDuplicate = updatedVol.some((existing: any) => {
            const eNameClean = (existing.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const eRoleClean = (existing.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return eNameClean === nameClean && (eRoleClean === roleClean || !eRoleClean || !roleClean);
          });

          if (!isDuplicate) {
            updatedVol.push(vol);
            addedNew = true;
          }
        }

        if (addedNew || (updatedVol.length > 0 && currentVol.length === 0)) {
          mergedProfile.volunteerExperience = {
            value: updatedVol,
            source: mergedProfile.volunteerExperience.source === 'None' ? response.sourceName : mergedProfile.volunteerExperience.source,
            confidence: mergedProfile.volunteerExperience.confidence === 0 ? response.confidence : mergedProfile.volunteerExperience.confidence,
            timestamp,
            verification: mergedProfile.volunteerExperience.verification === 'Unverified' ? verification : mergedProfile.volunteerExperience.verification
          };
          sourceAttribution.volunteerExperience = mergedProfile.volunteerExperience;
        }
      }

      // 4. Simple List Arrays (merge & deduplicate list items from multiple sources)
      const listFields = [
        'skills', 'certifications', 'achievements',
        'languages', 'interests', 'primaryLanguages', 'technologies'
      ];
      for (const field of listFields) {
        if (response.data[field] && Array.isArray(response.data[field])) {
          const list = response.data[field] as string[];
          const existing = mergedProfile[field]?.value || [];
          const uniqueItems = list.filter(item => !existing.includes(item));
          
          if (uniqueItems.length > 0) {
            const newValue = [...existing, ...uniqueItems];
            // Track the source with the highest confidence that contributed this array
            const currentSource = mergedProfile[field]?.source === 'None' ? response.sourceName : mergedProfile[field]?.source;
            const currentConfidence = mergedProfile[field]?.confidence === 0 ? response.confidence : mergedProfile[field]?.confidence;
            const currentVerification = mergedProfile[field]?.verification === 'Unverified' ? verification : mergedProfile[field]?.verification;

            mergedProfile[field] = {
              value: newValue,
              source: currentSource,
              confidence: currentConfidence,
              timestamp,
              verification: currentVerification
            };
            sourceAttribution[field] = mergedProfile[field];
          }
        }
      }

      // 5. Public profile links (merge unique)
      if (response.data.publicProfiles && Array.isArray(response.data.publicProfiles)) {
        const existingLinks = mergedProfile.publicProfiles.value || [];
        const addedLinks = [...existingLinks];
        let hasNew = false;
        
        for (const link of response.data.publicProfiles) {
          if (link.url && !addedLinks.some(p => p.url === link.url)) {
            addedLinks.push(link);
            hasNew = true;
          }
        }

        if (hasNew) {
          mergedProfile.publicProfiles = {
            value: addedLinks,
            source: response.sourceName,
            confidence: response.confidence,
            timestamp,
            verification
          };
          sourceAttribution.publicProfiles = mergedProfile.publicProfiles;
        }
      }

      // 6. ScrapeCreators data (merge all unique platform responses)
      if (response.data.scrapeCreatorsData) {
        const existingData = mergedProfile.scrapeCreatorsData.value || [];
        const newData = [...existingData];
        const incoming = Array.isArray(response.data.scrapeCreatorsData)
          ? response.data.scrapeCreatorsData
          : [response.data.scrapeCreatorsData];
        
        let hasNew = false;
        for (const item of incoming) {
          if (item && item.platform && !newData.some((existing: any) => existing.platform === item.platform)) {
            newData.push(item);
            hasNew = true;
          }
        }
        
        if (hasNew || (newData.length > 0 && existingData.length === 0)) {
          mergedProfile.scrapeCreatorsData = {
            value: newData,
            source: response.sourceName,
            confidence: response.confidence,
            timestamp,
            verification
          };
          sourceAttribution.scrapeCreatorsData = mergedProfile.scrapeCreatorsData;
        }
      }
    }

    return {
      mergedProfile: mergedProfile as MergedProfile,
      sourceAttribution
    };
  }
}
