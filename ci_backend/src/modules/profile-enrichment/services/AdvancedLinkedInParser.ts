import logger from '../../../config/logger';

/**
 * Advanced LinkedIn Biography Parser
 * Parses LinkedIn-formatted biography text with proper structure recognition
 * Handles real LinkedIn date formats, role hierarchies, and multi-position entries
 */
export class AdvancedLinkedInParser {
  /**
   * Parse comprehensive LinkedIn biography
   * Extracts experience, education, organizations, volunteering with high accuracy
   */
  parseLinkedInBiography(biography: string): {
    experience: Array<any>;
    education: Array<any>;
    organizations: Array<any>;
    volunteerExperience: Array<any>;
  } {
    const result = {
      experience: [],
      education: [],
      organizations: [],
      volunteerExperience: []
    };

    if (!biography || biography.length < 50) {
      return result;
    }

    // Parse experience - LinkedIn format with roles grouped by company
    result.experience = this.parseExperienceFromBiography(biography);
    
    // Parse education
    result.education = this.parseEducationFromBiography(biography);
    
    // Parse organizations
    result.organizations = this.parseOrganizationsFromBiography(biography);
    
    // Parse volunteering
    result.volunteerExperience = this.parseVolunteeringFromBiography(biography);

    return result;
  }

  /**
   * Parse experience entries from LinkedIn biography
   * Handles multiple roles at same company, various date formats
   */
  private parseExperienceFromBiography(biography: string): Array<any> {
    const experiences: Array<any> = [];

    // Split by company (companies usually end with a number of positions)
    // Pattern: "Company Name" followed by "Full-time · X mos" or similar
    const companyPattern = /([A-Z][A-Za-z\s&0-9\-\.]+?)\s*(?:\n|Full-time|Part-time|Freelance|Contract|Temporary)\s*·\s*\d+\s+(?:yrs?|mos?)/gi;

    // More detailed parsing: look for role blocks
    const rolePattern = /([A-Z][A-Za-z\s]+?)\s+at\s+([A-Z][A-Za-z\s&0-9\-\.]+?)\s*·\s*(Full-time|Part-time|Freelance|Contract|Temporary)?\s*(?:·)?\s*([^·\n]*?)\s*·\s+([A-Za-z]+\s+\d{4})\s*[-–]\s*(Present|[A-Za-z]+\s+\d{4})?\s*·\s*([^\n]+?)(?:\n|$)/gi;

    let match;
    const processedRoles = new Set<string>();

    while ((match = rolePattern.exec(biography)) !== null) {
      const title = match[1]?.trim() || '';
      const company = match[2]?.trim() || '';
      const employmentType = match[3]?.trim() || '';
      const location = match[4]?.trim() || '';
      const startDate = match[5]?.trim() || '';
      const endDate = match[6]?.trim() || 'Present';
      const duration = match[7]?.trim() || '';

      const roleKey = `${title}@${company}@${startDate}`;

      if (title && company && !processedRoles.has(roleKey)) {
        processedRoles.add(roleKey);
        
        experiences.push({
          title,
          company,
          startDate: this.normalizeDate(startDate),
          endDate: endDate === 'Present' ? 'Present' : this.normalizeDate(endDate),
          duration: this.normalizeDuration(duration),
          location,
          description: '',
          employmentType
        });
      }
    }

    // If pattern 1 didn't find enough, try alternative parsing
    if (experiences.length < 2) {
      const altExperiences = this.parseExperienceAlternative(biography);
      experiences.push(...altExperiences.filter(exp => 
        !experiences.some(e => e.title === exp.title && e.company === exp.company && e.startDate === exp.startDate)
      ));
    }

    logger.debug(`[AdvancedLinkedInParser] Parsed ${experiences.length} experience entries`);
    return experiences;
  }

  /**
   * Alternative experience parsing for different formats
   */
  private parseExperienceAlternative(biography: string): Array<any> {
    const experiences: Array<any> = [];

    // Look for role titles followed by company name (with "at")
    const lines = biography.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Check if this line looks like a job title
      if (this.isLikelyJobTitle(line)) {
        const title = line;
        const company = this.extractCompanyFromNextLines(lines, i);
        const dates = this.extractDatesFromNextLines(lines, i);

        if (company) {
          experiences.push({
            title,
            company,
            startDate: dates.startDate,
            endDate: dates.endDate,
            duration: dates.duration,
            location: '',
            description: '',
            employmentType: ''
          });
        }
      }

      i++;
    }

    return experiences;
  }

  /**
   * Parse education from biography
   */
  private parseEducationFromBiography(biography: string): Array<any> {
    const education: Array<any> = [];

    // Look for education section or school names
    const schoolPattern = /(?:^|\n)([A-Z][A-Za-z\s&0-9\-\.]+?)\s*(?:·|,)\s+([^·\n]+?)(?:\s*(?:·|,)\s+([0-9]{4}|Graduated))?\s*(?:\n|$)/gm;

    // More specific: "School Name · Degree, Field · Year" format
    const educationDetailPattern = /([A-Z][A-Za-z\s&0-9\-\.]+?)\s+·\s+([^·,\n]+?)(?:\s*,\s+([^·\n]+?))?(?:\s+·\s+([0-9]{4}))?/g;

    let match;
    const processedSchools = new Set<string>();

    while ((match = educationDetailPattern.exec(biography)) !== null) {
      const school = match[1]?.trim() || '';
      const degree = match[2]?.trim() || 'N/A';
      const fieldOfStudy = match[3]?.trim() || 'N/A';
      const year = match[4]?.trim() || 'N/A';

      if (school && !processedSchools.has(school)) {
        processedSchools.add(school);
        
        education.push({
          school,
          degree: degree !== 'N/A' ? degree : 'Degree',
          fieldOfStudy: fieldOfStudy !== 'N/A' ? fieldOfStudy : 'Field of Study',
          year,
          startDate: 'N/A',
          endDate: 'N/A'
        });
      }
    }

    logger.debug(`[AdvancedLinkedInParser] Parsed ${education.length} education entries`);
    return education;
  }

  /**
   * Parse organizations
   */
  private parseOrganizationsFromBiography(biography: string): Array<any> {
    const organizations: Array<any> = [];

    // Look for "Role at Organization" pattern
    const orgPattern = /([A-Z][a-zA-Z\s]+?)\s+at\s+([A-Z][a-zA-Z\s&0-9\-\.]+?)(?:\s·|\s-|,|$)/g;

    // Filter to likely organization entries (not job titles with "at")
    let match;
    const processed = new Set<string>();

    while ((match = orgPattern.exec(biography)) !== null) {
      const role = match[1]?.trim() || '';
      const name = match[2]?.trim() || '';

      const key = `${role}@${name}`;
      if (name && !processed.has(key) && name.length > 3) {
        processed.add(key);
        
        // Only add if it looks like an organization (not a company)
        if (!this.looksLikeCompany(name)) {
          organizations.push({
            name,
            role,
            period: 'N/A'
          });
        }
      }
    }

    logger.debug(`[AdvancedLinkedInParser] Parsed ${organizations.length} organization entries`);
    return organizations;
  }

  /**
   * Parse volunteering
   */
  private parseVolunteeringFromBiography(biography: string): Array<any> {
    const volunteering: Array<any> = [];

    // Look for volunteer-related patterns
    const volPattern = /(?:Volunteer|Volunteering)[\s:]*([A-Z][a-zA-Z\s]+?)\s+at\s+([A-Z][a-zA-Z\s&0-9\-\.]+?)(?:\s·|\s-|,|$)/gi;

    let match;
    const processed = new Set<string>();

    while ((match = volPattern.exec(biography)) !== null) {
      const role = match[1]?.trim() || '';
      const organization = match[2]?.trim() || '';

      const key = `${role}@${organization}`;
      if (organization && !processed.has(key)) {
        processed.add(key);
        
        volunteering.push({
          role,
          organization,
          startDate: 'N/A',
          endDate: 'Present'
        });
      }
    }

    logger.debug(`[AdvancedLinkedInParser] Parsed ${volunteering.length} volunteer entries`);
    return volunteering;
  }

  // ─── Helper Methods ───

  private isLikelyJobTitle(text: string): boolean {
    const titleKeywords = [
      'lead', 'manager', 'director', 'specialist', 'engineer', 'developer', 
      'architect', 'analyst', 'consultant', 'officer', 'executive', 'head',
      'coordinator', 'assistant', 'associate', 'partner', 'founder', 'owner',
      'operations', 'business', 'sales', 'marketing', 'product', 'hr',
      'human resources', 'senior', 'junior', 'principal'
    ];

    const lowerText = text.toLowerCase();
    return titleKeywords.some(keyword => lowerText.includes(keyword)) && text.length < 100;
  }

  private extractCompanyFromNextLines(lines: string[], startIndex: number): string {
    for (let i = startIndex + 1; i < Math.min(startIndex + 5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.includes(' at ')) {
        const parts = line.split(' at ');
        return parts[1]?.split('·')[0]?.trim() || '';
      }
      if (line.length > 3 && line.match(/^[A-Z]/)) {
        return line.split('·')[0]?.trim() || '';
      }
    }
    return '';
  }

  private extractDatesFromNextLines(lines: string[], startIndex: number): { startDate: string; endDate: string; duration: string } {
    for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
      const line = lines[i];
      const dateMatch = line.match(/([A-Za-z]+\s+\d{4})\s*[-–]\s*(Present|[A-Za-z]+\s+\d{4})?/);
      
      if (dateMatch) {
        const startDate = this.normalizeDate(dateMatch[1]);
        const endDate = dateMatch[2] ? (dateMatch[2] === 'Present' ? 'Present' : this.normalizeDate(dateMatch[2])) : 'Present';
        
        const duration = this.calculateDuration(dateMatch[1], dateMatch[2]);
        return { startDate, endDate, duration };
      }
    }
    return { startDate: 'N/A', endDate: 'Present', duration: '' };
  }

  private normalizeDate(dateStr: string): string {
    // Convert "Jan 2020" to standard format
    return dateStr?.trim() || 'N/A';
  }

  private normalizeDuration(durationStr: string): string {
    const match = durationStr?.match(/(\d+\s+(?:yrs?|years?|mos?|months?))/i);
    return match ? match[1] : '';
  }

  private calculateDuration(startDate: string, endDate?: string): string {
    // Simple calculation based on date strings
    const startMatch = startDate.match(/(\d{4})/);
    const endMatch = endDate?.match(/(\d{4})/);

    if (startMatch && endMatch) {
      const years = parseInt(endMatch[1]) - parseInt(startMatch[1]);
      if (years > 0) {
        return `${years} yr${years > 1 ? 's' : ''}`;
      }
    }
    return '';
  }

  private looksLikeCompany(name: string): boolean {
    const companyIndicators = ['Inc', 'LLC', 'Corp', 'Ltd', 'Co', 'Group', 'Solutions'];
    return companyIndicators.some(indicator => name.includes(indicator));
  }
}
