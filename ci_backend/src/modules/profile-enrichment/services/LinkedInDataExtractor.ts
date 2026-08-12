import logger from '../../../config/logger';

export interface LinkedInProfile {
  experience: Array<{
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    duration?: string;
    description?: string;
    location?: string;
  }>;
  education: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
  }>;
  organizations?: Array<{
    name: string;
    role?: string;
    period?: string;
  }>;
  volunteerExperience?: Array<{
    role?: string;
    organization?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

/**
 * LinkedIn Data Extractor
 * Parses LinkedIn profile content and extracts structured data
 * Handles common LinkedIn date formats and role descriptions
 */
export class LinkedInDataExtractor {
  /**
   * Extract structured data from LinkedIn profile HTML/text
   * This handles the real LinkedIn format with proper dates and descriptions
   */
  extractStructuredData(profileContent: string): LinkedInProfile {
    const result: LinkedInProfile = {
      experience: [],
      education: [],
      organizations: [],
      volunteerExperience: []
    };

    if (!profileContent || profileContent.length === 0) {
      return result;
    }

    // Extract Experience Section
    result.experience = this.extractExperienceFromContent(profileContent);
    
    // Extract Education Section
    result.education = this.extractEducationFromContent(profileContent);
    
    // Extract Organizations
    result.organizations = this.extractOrganizationsFromContent(profileContent);
    
    // Extract Volunteering
    result.volunteerExperience = this.extractVolunteeringFromContent(profileContent);

    logger.debug(`[LinkedInDataExtractor] Extracted: ${result.experience.length} experiences, ${result.education.length} education, ${result.organizations?.length || 0} orgs, ${result.volunteerExperience?.length || 0} volunteer`);

    return result;
  }

  /**
   * Extract experience entries with real LinkedIn format support
   * Handles multiple date formats and current positions
   */
  private extractExperienceFromContent(content: string): Array<any> {
    const experiences: Array<any> = [];
    
    // Pattern 1: "Job Title at Company · Full-time/Part-time · Location · Jan 2020 - Dec 2023 · 2 yrs 3 mos"
    const pattern1 = /([A-Z][a-z\s]+)\s+at\s+([A-Z][^·\n]+?)\s+·\s+(?:[A-Za-z\-]+\s+·\s+)?([^·\n]*?)\s*·\s+([A-Za-z]{3}\s+\d{4})\s*-\s*(Present|[A-Za-z]{3}\s+\d{4})?.*?(?:·\s+([^·\n]+?))?(?:\n|$)/g;
    
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const title = match[1].trim();
      const company = match[2].trim();
      const location = match[3]?.trim() || '';
      const startDate = match[4]?.trim();
      const endDate = match[5]?.trim() || 'Present';
      const duration = match[6]?.trim();

      if (title && company) {
        experiences.push({
          title,
          company,
          startDate,
          endDate: endDate === 'Present' ? 'Present' : endDate,
          location,
          duration: duration || this.calculateDuration(startDate, endDate),
          description: ''
        });
      }
    }

    // Pattern 2: Multi-line format with descriptions
    const experienceSectionMatch = content.match(/Experience[\n\r]+([\s\S]*?)(?:Education|Volunteering|Organizations|$)/i);
    if (experienceSectionMatch) {
      const expSection = experienceSectionMatch[1];
      
      // Split by role entries (new role starts with capital letter and includes "at" or similar)
      const rolePattern = /([A-Z][a-zA-Z\s]+)\n([A-Z][a-zA-Z\s]+?)(?:\n|·)(.*?)(?=\n[A-Z][a-zA-Z\s]+\n|\n\n|Volunteering|Organizations|Education|$)/gs;
      
      let roleMatch;
      while ((roleMatch = rolePattern.exec(expSection)) !== null) {
        const title = roleMatch[1].trim();
        const company = roleMatch[2].trim();
        const details = roleMatch[3].trim();

        // Skip if already added from pattern1
        if (!experiences.some(e => e.title === title && e.company === company)) {
          // Extract dates from details
          const dateMatch = details.match(/([A-Za-z]{3}\s+\d{4})\s*-\s*(Present|[A-Za-z]{3}\s+\d{4})?/);
          
          experiences.push({
            title,
            company,
            startDate: dateMatch ? dateMatch[1] : 'N/A',
            endDate: dateMatch ? (dateMatch[2] || 'Present') : 'N/A',
            location: '',
            duration: this.extractDurationFromText(details),
            description: this.cleanDescription(details.replace(/\d{4}\s*-\s*\d{4}|\d{4}|Present|\d+\s+(?:yrs?|months?)/gi, ''))
          });
        }
      }
    }

    return experiences;
  }

  /**
   * Extract education entries
   */
  private extractEducationFromContent(content: string): Array<any> {
    const education: Array<any> = [];

    // Pattern: "School Name · Degree, Field of Study · Year"
    const pattern = /([A-Z][a-zA-Z\s&]+?)\s+·\s+(?:([^·,]+?)(?:\s*,\s*([^·\n]+?))?)?(?:\s*·\s*([0-9]{4}|Graduate|Completed))?/g;
    
    const educationMatch = content.match(/Education[\n\r]+([\s\S]*?)(?:Experience|Volunteering|Organizations|$)/i);
    if (!educationMatch) return education;

    const eduSection = educationMatch[1];
    
    // Extract school entries
    const schoolPattern = /^([A-Z][a-zA-Z\s&0-9]+)$/gm;
    let schoolMatch;
    
    while ((schoolMatch = schoolPattern.exec(eduSection)) !== null) {
      const school = schoolMatch[1].trim();
      
      // Look for degree and field in the next lines
      const schoolIndex = eduSection.indexOf(school);
      const nextContent = eduSection.substring(schoolIndex + school.length, schoolIndex + 300);
      
      const degreeMatch = nextContent.match(/^(?:\n\s*)?(?:·\s+)?([^·\n]+?)(?:\s*,\s*([^·\n]+))?(?:\n|·|$)/);
      
      if (school && !education.some(e => e.school === school)) {
        education.push({
          school: school.trim(),
          degree: degreeMatch ? degreeMatch[1]?.trim() : 'N/A',
          fieldOfStudy: degreeMatch ? degreeMatch[2]?.trim() : 'N/A',
          year: 'N/A',
          startDate: 'N/A',
          endDate: 'N/A'
        });
      }
    }

    return education;
  }

  /**
   * Extract organizations
   */
  private extractOrganizationsFromContent(content: string): Array<any> {
    const organizations: Array<any> = [];

    const orgMatch = content.match(/Organizations?[\n\r]+([\s\S]*?)(?:Volunteering|Experience|Education|$)/i);
    if (!orgMatch) return organizations;

    const orgSection = orgMatch[1];
    
    // Extract organization entries
    const entries = orgSection.split(/\n(?=[A-Z])/);
    
    for (const entry of entries) {
      const parts = entry.split('·');
      if (parts.length >= 2) {
        organizations.push({
          name: parts[0].trim(),
          role: parts[1]?.trim() || 'Member',
          period: parts[2]?.trim() || 'N/A'
        });
      }
    }

    return organizations;
  }

  /**
   * Extract volunteering experience
   */
  private extractVolunteeringFromContent(content: string): Array<any> {
    const volunteering: Array<any> = [];

    const volMatch = content.match(/Volunteer(?:ing)?[\n\r]+([\s\S]*?)(?:Experience|Organizations|Education|$)/i);
    if (!volMatch) return volunteering;

    const volSection = volMatch[1];
    
    // Extract volunteer entries
    const entries = volSection.split(/\n(?=[A-Z])/);
    
    for (const entry of entries) {
      const parts = entry.split('·');
      if (parts.length >= 1) {
        volunteering.push({
          role: parts[0].trim(),
          organization: parts[1]?.trim() || 'N/A',
          startDate: parts[2]?.trim() || 'N/A',
          endDate: parts[3]?.trim() || 'Present'
        });
      }
    }

    return volunteering;
  }

  /**
   * Helper: Extract duration text
   */
  private extractDurationFromText(text: string): string {
    const durationMatch = text.match(/(\d+\s+(?:yrs?|years?|mos?|months?)(?:\s+\d+\s+(?:mos?|months?))?)/i);
    return durationMatch ? durationMatch[1] : '';
  }

  /**
   * Helper: Calculate duration from dates
   */
  private calculateDuration(startDate?: string, endDate?: string): string {
    if (!startDate) return '';
    
    try {
      const start = new Date(startDate);
      const end = endDate && endDate !== 'Present' ? new Date(endDate) : new Date();
      
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      
      if (years > 0 && remainingMonths > 0) {
        return `${years} yr${years > 1 ? 's' : ''} ${remainingMonths} mo${remainingMonths > 1 ? 's' : ''}`;
      } else if (years > 0) {
        return `${years} yr${years > 1 ? 's' : ''}`;
      } else if (months > 0) {
        return `${months} mo${months > 1 ? 's' : ''}`;
      }
    } catch (e) {
      // Fallback to text extraction
      return this.extractDurationFromText(startDate || '');
    }
    
    return '';
  }

  /**
   * Helper: Clean description text
   */
  private cleanDescription(text: string): string {
    return text
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
  }
}
