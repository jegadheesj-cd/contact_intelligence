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
  experience: VerifiedField<Array<{ title: string; company: string; period: string; description?: string }>>;
  education: VerifiedField<Array<{ school: string; degree: string; year: string; fieldOfStudy?: string }>>;
  skills: VerifiedField<string[]>;
  projects: VerifiedField<Array<{ name: string; description: string; technologies?: string[]; duration?: string }>>;
  certifications?: VerifiedField<string[]>;
  achievements?: VerifiedField<string[]>;
  organizations?: VerifiedField<string[]>;
  volunteerExperience?: VerifiedField<string[]>;
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
      languages: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      interests: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      repositories: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      pinnedRepositories: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      primaryLanguages: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' },
      technologies: { value: [], source: 'None', confidence: 0, timestamp, verification: 'Unverified' }
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
      const arrayFields = ['experience', 'education', 'projects', 'repositories', 'pinnedRepositories'];
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

      // 4. Simple List Arrays (merge & deduplicate list items from multiple sources)
      const listFields = [
        'skills', 'certifications', 'achievements', 'organizations',
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
    }

    return {
      mergedProfile: mergedProfile as MergedProfile,
      sourceAttribution
    };
  }
}
