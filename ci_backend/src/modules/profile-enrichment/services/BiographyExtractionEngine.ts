import logger from '../../../config/logger';

export interface ExtractedExperience {
  title: string;
  company: string;
  companyLogo?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  duration?: string;
  location?: string;
  description?: string;
  skills?: string[];
}

export interface ExtractedEducation {
  school: string;
  degree?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  fieldOfStudy?: string;
  description?: string;
  activities?: string;
}

export interface ExtractedOrganization {
  name: string;
  role?: string;
  period?: string;
  description?: string;
}

export interface ExtractedData {
  experience: ExtractedExperience[];
  education: ExtractedEducation[];
  organizations: ExtractedOrganization[];
  volunteerExperience: ExtractedOrganization[];
}

export class BiographyExtractionEngine {
  /**
   * Extracts structured experience, education, organizations, and volunteering data from biography text.
   * This parser is more aggressive than the frontend parser and designed for backend processing.
   */
  public extractFromBiography(biographyText: string | null | undefined): ExtractedData {
    const result: ExtractedData = {
      experience: [],
      education: [],
      organizations: [],
      volunteerExperience: []
    };

    if (!biographyText || typeof biographyText !== 'string' || biographyText.trim().length === 0) {
      return result;
    }

    try {
      // Split biography into sections
      const sections = this.parseSections(biographyText);

      for (const section of sections) {
        if (!section.content || section.content.trim().length === 0) continue;

        const header = (section.header || '').toLowerCase();

        if (this.isExperienceSection(header)) {
          const exps = this.parseExperienceSection(section.content);
          result.experience.push(...exps);
        } else if (this.isEducationSection(header)) {
          const edus = this.parseEducationSection(section.content);
          result.education.push(...edus);
        } else if (this.isOrganizationSection(header)) {
          const orgs = this.parseOrganizationSection(section.content);
          result.organizations.push(...orgs);
        } else if (this.isVolunteeringSection(header)) {
          const vols = this.parseVolunteeringSection(section.content);
          result.volunteerExperience.push(...vols);
        }
      }

      // Also parse from unstructured text if no structured sections found
      if (result.experience.length === 0) {
        const expsFromText = this.extractExperienceFromText(biographyText);
        result.experience.push(...expsFromText);
      }

      if (result.education.length === 0) {
        const edusFromText = this.extractEducationFromText(biographyText);
        result.education.push(...edusFromText);
      }

      if (result.organizations.length === 0 && result.volunteerExperience.length === 0) {
        const orgsFromText = this.extractOrganizationsFromText(biographyText);
        result.organizations.push(...orgsFromText);
      }

      logger.debug(`[BiographyExtractionEngine] Extracted: ${result.experience.length} experiences, ${result.education.length} educations, ${result.organizations.length} organizations, ${result.volunteerExperience.length} volunteer records`);
      return result;
    } catch (err: any) {
      logger.warn(`[BiographyExtractionEngine] Error parsing biography: ${err.message}`);
      return result;
    }
  }

  private parseSections(text: string): Array<{ header: string; content: string }> {
    const sections: Array<{ header: string; content: string }> = [];

    // Try markdown format first (##, ###)
    if (text.includes('##')) {
      const parts = text.split(/(?<!#)##(?!#)\s+/);
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const lines = part.split('\n');
        const header = lines[0].trim();
        const content = lines.slice(1).join('\n');
        if (header && content.trim()) {
          sections.push({ header, content });
        }
      }
      return sections;
    }

    // Try colon-separated format (Experience:, Education:)
    const colonSectionPattern = /([A-Za-z\s&]+?):\s*([\s\S]*?)(?=\n\n[A-Za-z\s&]+:\s|$)/g;
    let match;
    while ((match = colonSectionPattern.exec(text)) !== null) {
      const header = match[1].trim();
      const content = match[2].trim();
      if (header && content) {
        sections.push({ header, content });
      }
    }

    return sections;
  }

  private isExperienceSection(header: string): boolean {
    return /\b(experience|work|career|professional history|employment|jobs|positions?)\b/i.test(header);
  }

  private isEducationSection(header: string): boolean {
    return /\b(education|academic|schooling|degrees?|university|college|institutes?)\b/i.test(header);
  }

  private isOrganizationSection(header: string): boolean {
    return /\b(organizations?|associations?|memberships?|clubs?|groups?|societies?)\b/i.test(header) &&
           !/volunteer/i.test(header);
  }

  private isVolunteeringSection(header: string): boolean {
    return /\b(volunteer|volunteering|volunteered|volunteer.*experience|community service)\b/i.test(header);
  }

  private parseExperienceSection(content: string): ExtractedExperience[] {
    const experiences: ExtractedExperience[] = [];
    const entries = this.splitEntries(content);

    for (const entry of entries) {
      if (entry.trim().length === 0) continue;
      
      const exp = this.parseExperienceEntry(entry);
      if (exp && (exp.title || exp.company)) {
        experiences.push(exp);
      }
    }

    return experiences;
  }

  private parseExperienceEntry(text: string): ExtractedExperience | null {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const exp: ExtractedExperience = {
      title: '',
      company: ''
    };

    // Try to extract title and company from first line
    const firstLine = lines[0];
    const atPattern = /\s+(?:at|@|-)\s+/i;
    const atMatch = firstLine.match(atPattern);

    if (atMatch) {
      const beforeAt = firstLine.substring(0, atMatch.index).trim();
      const afterAt = firstLine.substring(atMatch.index! + atMatch[0].length).trim();
      exp.title = beforeAt;
      exp.company = afterAt;
    } else {
      exp.title = firstLine;
    }

    // Extract dates
    const dateMatch = text.match(/(\w+\s+\d{4})\s*[-–to]+\s*(\w+\s+\d{4}|Present|Current)/i);
    if (dateMatch) {
      exp.period = dateMatch[0];
      exp.startDate = dateMatch[1];
      exp.endDate = dateMatch[2];
      exp.isCurrent = /present|current/i.test(dateMatch[2]);
    } else {
      const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        exp.period = yearMatch[1];
        exp.startDate = yearMatch[1];
      }
    }

    // Extract description (remaining lines)
    if (lines.length > 1) {
      const descLines = lines.slice(1)
        .filter(l => !this.isDateLine(l) && !this.isJobTitleLine(l))
        .join(' ');
      if (descLines) {
        exp.description = descLines.substring(0, 500); // Limit to 500 chars
      }
    }

    return exp;
  }

  private parseEducationSection(content: string): ExtractedEducation[] {
    const educations: ExtractedEducation[] = [];
    const entries = this.splitEntries(content);

    for (const entry of entries) {
      if (entry.trim().length === 0) continue;
      
      const edu = this.parseEducationEntry(entry);
      if (edu && (edu.school || edu.degree)) {
        educations.push(edu);
      }
    }

    return educations;
  }

  private parseEducationEntry(text: string): ExtractedEducation | null {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const edu: ExtractedEducation = {
      school: ''
    };

    // Extract degree and school from first line
    const firstLine = lines[0];
    const degreePattern = /\b(b\.?\s*a\.?|b\.?\s*sc\.?|b\.?\s*tech\.?|m\.?\s*a\.?|m\.?\s*sc\.?|m\.?\s*tech\.?|m\.?\s*b\.?\s*a\.?|ph\.?\s*d\.?|diploma|degree|certificate|bachelor|master|doctorate|associate)\b/i;
    const schoolPattern = /\b(college|university|school|institute|academy|polytechnic)\b/i;

    const degreeMatch = firstLine.match(degreePattern);
    const schoolMatch = firstLine.match(schoolPattern);

    if (degreeMatch) {
      edu.degree = degreeMatch[0];
    }

    if (schoolMatch) {
      edu.school = schoolMatch[0];
    }

    // If we haven't found school/degree, use first line as school
    if (!edu.school && !edu.degree) {
      edu.school = firstLine;
    } else if (!edu.school) {
      edu.school = firstLine.replace(degreePattern, '').trim();
    } else if (!edu.degree) {
      edu.degree = firstLine.replace(schoolPattern, '').trim();
    }

    // Extract year/dates
    const dateMatch = text.match(/(\d{4})\s*[-–to]+\s*(\d{4}|Present|Current)/i);
    if (dateMatch) {
      edu.startDate = dateMatch[1];
      edu.endDate = dateMatch[2];
      edu.year = `${dateMatch[1]} - ${dateMatch[2]}`;
    } else {
      const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        edu.year = yearMatch[1];
      }
    }

    // Extract field of study
    const fieldPattern = /(?:field of study|program|major|specialization)[:\s]+([\w\s,&-]+)/i;
    const fieldMatch = text.match(fieldPattern);
    if (fieldMatch) {
      edu.fieldOfStudy = fieldMatch[1].trim();
    }

    // Extract description (remaining lines)
    if (lines.length > 1) {
      edu.description = lines.slice(1).join(' ').substring(0, 300);
    }

    return edu;
  }

  private parseOrganizationSection(content: string): ExtractedOrganization[] {
    const orgs: ExtractedOrganization[] = [];
    const entries = this.splitEntries(content);

    for (const entry of entries) {
      if (entry.trim().length === 0) continue;
      
      const org = this.parseOrganizationEntry(entry);
      if (org && org.name) {
        orgs.push(org);
      }
    }

    return orgs;
  }

  private parseOrganizationEntry(text: string): ExtractedOrganization | null {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    return {
      name: lines[0],
      role: lines.length > 1 ? lines[1] : undefined,
      description: lines.length > 2 ? lines.slice(2).join(' ').substring(0, 300) : undefined
    };
  }

  private parseVolunteeringSection(content: string): ExtractedOrganization[] {
    // Same structure as organizations
    return this.parseOrganizationSection(content);
  }

  private extractExperienceFromText(text: string): ExtractedExperience[] {
    const experiences: ExtractedExperience[] = [];

    // Pattern for job entries like "Title at Company (dates)"
    const jobPattern = /([A-Z][A-Za-z\s&]+)\s+(?:at|@)\s+([A-Z][A-Za-z0-9\s&,.-]+?)(?:\s*\(([^)]*)\))?(?:[\n,•-]|$)/g;
    
    let match;
    while ((match = jobPattern.exec(text)) !== null) {
      const title = match[1].trim();
      const company = match[2].trim();
      const meta = match[3]?.trim() || '';

      if (title && company) {
        const exp: ExtractedExperience = { title, company };
        
        // Extract dates from meta
        if (meta) {
          const dateMatch = meta.match(/(\w+\s+\d{4})\s*[-–to]+\s*(\w+\s+\d{4}|Present|Current)/i);
          if (dateMatch) {
            exp.period = dateMatch[0];
            exp.startDate = dateMatch[1];
            exp.endDate = dateMatch[2];
            exp.isCurrent = /present|current/i.test(dateMatch[2]);
          }
        }

        experiences.push(exp);
      }
    }

    // Also look for patterns with numbers
    if (experiences.length === 0) {
      const yearPattern = /(\d{1,2}\s+)?(?:years?|yrs?)\s+(?:of\s+)?(?:experience|as|working)\s+(?:at|as)\s+([A-Za-z0-9\s&,.-]+?)(?:[\n,•-]|$)/gi;
      while ((match = yearPattern.exec(text)) !== null) {
        if (match[2]) {
          experiences.push({
            title: 'Professional Experience',
            company: match[2].trim()
          });
        }
      }
    }

    return experiences.slice(0, 10); // Limit to 10
  }

  private extractEducationFromText(text: string): ExtractedEducation[] {
    const educations: ExtractedEducation[] = [];

    // Pattern for education entries like "Degree from School (year)"
    const eduPattern = /([A-Z][A-Za-z0-9\s.&-]+?)(?:\s+(?:from|at|in)\s+)?([A-Z][A-Za-z0-9\s&,.-]*?)(?:\s*\((\d{4})\))?(?:[\n,•-]|$)/g;
    
    // More specific pattern first
    const degreePattern = /(?:Bachelor|Master|MBA|B\.S\.|M\.S\.|Ph\.D|B\.A\.|M\.A\.|B\.Tech|M\.Tech)[\w\s&-]*\s+(?:from|at|in)\s+([A-Za-z\s&,.-]+?)(?:\s*\((\d{4})\))?(?:[\n,•-]|$)/gi;

    let match;
    while ((match = degreePattern.exec(text)) !== null) {
      const school = match[1].trim();
      const year = match[2]?.trim();

      if (school) {
        const edu: ExtractedEducation = { school };
        if (year) edu.year = year;
        educations.push(edu);
      }
    }

    // Also look for institution names with college/university keywords
    const schoolPattern = /([A-Z][A-Za-z\s&,.-]*?)(?:\s+College|\s+University|\s+Institute|\s+Academy)(?:\s*\((\d{4})\))?(?:[\n,•-]|$)/gi;
    while ((match = schoolPattern.exec(text)) !== null) {
      const school = (match[1] + (match[0].includes('College') ? ' College' : match[0].includes('University') ? ' University' : match[0].includes('Institute') ? ' Institute' : ' Academy')).trim();
      const year = match[2]?.trim();

      if (school && !educations.some(e => e.school?.toLowerCase() === school.toLowerCase())) {
        const edu: ExtractedEducation = { school };
        if (year) edu.year = year;
        educations.push(edu);
      }
    }

    return educations.slice(0, 5); // Limit to 5
  }

  private extractOrganizationsFromText(text: string): ExtractedOrganization[] {
    const orgs: ExtractedOrganization[] = [];

    // Pattern for organization mentions like "Member of XYZ"
    const memberPattern = /(?:Member|Head|President|Founder|Leader|Director|Chair|Co-founder|Ambassador)\s+(?:of|at)\s+([A-Z][A-Za-z\s&,.-]+?)(?:[\n,•-]|$)/gi;
    
    let match;
    while ((match = memberPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name && !orgs.some(o => o.name?.toLowerCase() === name.toLowerCase())) {
        orgs.push({ name });
      }
    }

    return orgs.slice(0, 5); // Limit to 5
  }

  private splitEntries(content: string): string[] {
    // Split by bullet points, line breaks, or other common separators
    return content
      .split(/[\n•–-]/)
      .filter(line => line.trim().length > 0);
  }

  private isDateLine(line: string): boolean {
    return /^\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i.test(line.trim());
  }

  private isJobTitleLine(line: string): boolean {
    return /^(?:Manager|Developer|Engineer|Analyst|Consultant|Specialist|Director|Lead|Head)/i.test(line.trim());
  }
}
