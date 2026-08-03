export interface ParsedExperience {
  title?: string;
  company?: string;
  employmentType?: string;
  period?: string;
  startYear?: string;
  endYear?: string;
  description?: string;
}

export interface ParsedEducation {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  year?: string;
  startYear?: string;
  endYear?: string;
  description?: string;
}

export interface ParsedBiography {
  experience: ParsedExperience[];
  education: ParsedEducation[];
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
}

function parseSingleEntry(text: string, type: 'experience' | 'education'): any {
  let cleaned = decodeHtmlEntities(text).trim();
  if (!cleaned) return null;

  // Extract year range / period
  let startYear = '';
  let endYear = '';
  let period = '';

  const rangeRegex = /\b(19\d{2}|20\d{2})\s*(?:-|–|to|\/)\s*(19\d{2}|20\d{2}|Present|Current)\b/i;
  const rangeMatch = cleaned.match(rangeRegex);
  if (rangeMatch) {
    period = rangeMatch[0].trim();
    startYear = rangeMatch[1];
    if (/\b(19\d{2}|20\d{2})\b/.test(rangeMatch[2])) {
      endYear = rangeMatch[2];
    }
    cleaned = cleaned.replace(rangeRegex, '');
  } else {
    // Look for a single year
    const singleYearRegex = /\b(19\d{2}|20\d{2})\b/;
    const singleMatch = cleaned.match(singleYearRegex);
    if (singleMatch) {
      startYear = singleMatch[1];
      endYear = singleMatch[1];
      period = singleMatch[1];
      cleaned = cleaned.replace(singleYearRegex, '');
    }
  }

  // Remove common placeholders (N/A, none, null, undefined) as whole words
  cleaned = cleaned.replace(/\b(n\/a|none|null|undefined)\b/gi, ' ');

  // Strip leading/trailing delimiters/punctuation
  cleaned = cleaned.replace(/^\s*[-•*+,;:|/]+\s*|\s*[-•*+,;:|/]+\s*$/g, '');

  // Split remaining text by potential delimiters
  const parts = cleaned
    .split(/\s*(?:,|\b-\b|•|;|\||\r?\n)\s*/)
    .map(p => p.trim())
    .filter(p => p.length > 1);

  if (type === 'experience') {
    let title = '';
    let company = '';
    let description = '';
    let employmentType = '';

    const empTypePattern = /\b(full[- ]time|part[- ]time|contract|freelance|internship|self[- ]employed|intern|co[- ]op)\b/i;
    // Patterns to detect designations/titles
    const titlePattern = /leader|manager|developer|engineer|director|analyst|consultant|specialist|head|vp|president|ceo|cto|founder|hrbp|acquisition|recruiter|lead|officer|architect|designer|practitioner/i;
    // Patterns to detect company names
    const companyPattern = /inc|ltd|llc|corp|corporation|company|co\.|destinations|technologies|solutions|systems|services|group|bank|university|labs/i;

    for (const part of parts) {
      const empMatch = part.match(empTypePattern);
      if (empMatch && !employmentType) {
        employmentType = empMatch[0];
        continue;
      }

      if (titlePattern.test(part) && !title) {
        title = part;
      } else if (companyPattern.test(part) && !company) {
        company = part;
      } else {
        if (!title) {
          title = part;
        } else if (!company) {
          company = part;
        } else {
          description = description ? description + '; ' + part : part;
        }
      }
    }

    return {
      title: title || undefined,
      company: company || undefined,
      employmentType: employmentType || undefined,
      period: period || undefined,
      startYear: startYear || undefined,
      endYear: endYear || undefined,
      description: description || undefined
    };
  } else {
    let school = '';
    let degree = '';
    let fieldOfStudy = '';
    let description = '';

    // Patterns for degree detection
    const degreePattern = /\b(b\.?\s*a\.?|m\.?\s*b\.?\s*a\.?|b\.?\s*com\.?|b\.?\s*sc\.?|m\.?\s*sc\.?|b\.?\s*tech\.?|m\.?\s*tech\.?|b\.?\s*e\.?|m\.?\s*e\.?|ph\.?\s*d\.?|doctorate|master|bachelor|diploma|degree|associate)\b/i;
    // Patterns for institution/school detection
    const schoolPattern = /\b(college|university|school|institute|academy|polytechnic|tech)\b/i;

    for (const part of parts) {
      if (degreePattern.test(part) && !degree) {
        degree = part;
      } else if (schoolPattern.test(part) && !school) {
        school = part;
      } else {
        if (!school) {
          school = part;
        } else if (!degree) {
          degree = part;
        } else if (!fieldOfStudy) {
          fieldOfStudy = part;
        } else {
          description = description ? description + '; ' + part : part;
        }
      }
    }

    return {
      school: school || undefined,
      degree: degree || undefined,
      fieldOfStudy: fieldOfStudy || undefined,
      year: endYear || startYear || undefined,
      startYear: startYear || undefined,
      endYear: endYear || undefined,
      description: description || undefined
    };
  }
}

function isValidEntry(entry: any, type: 'experience' | 'education'): boolean {
  if (!entry) return false;
  if (type === 'experience') {
    return !!(entry.title || entry.company);
  } else {
    return !!(entry.school || entry.degree || entry.fieldOfStudy);
  }
}

export function parseBiography(biographyText: string | null | undefined): ParsedBiography {
  if (!biographyText) {
    return { experience: [], education: [] };
  }

  const cleanedBio = decodeHtmlEntities(biographyText).trim();
  const isMarkdownFormat = cleanedBio.includes('##') || cleanedBio.includes('###');

  const experienceList: ParsedExperience[] = [];
  const educationList: ParsedEducation[] = [];

  if (isMarkdownFormat) {
    // Split by markdown main sections (##), ignoring ### subheadings
    const sections = cleanedBio.split(/(?<!#)##(?!#)\s+/);
    
    for (const section of sections) {
      const trimmedSec = section.trim();
      if (!trimmedSec) continue;

      // Extract section header (first word/phrase or first line)
      const firstLineEnd = trimmedSec.indexOf('\n');
      let header = '';
      let content = '';

      if (firstLineEnd !== -1) {
        header = trimmedSec.slice(0, firstLineEnd).trim();
        content = trimmedSec.slice(firstLineEnd).trim();
      } else {
        // Fallback check for single line section (e.g. "Experience N/A")
        const match = trimmedSec.match(/^(Experience|Professional Experience|Work History|Employment|Education|Academic Background|Skills|Awards|Honors|Certifications|Publications|Honors & Awards|About|Summary)(?:\b|[^a-zA-Z])/i);
        if (match) {
          header = match[1];
          content = trimmedSec.slice(match[0].length).trim();
        } else {
          const words = trimmedSec.split(/\s+/);
          header = words.slice(0, 2).join(' ');
          content = words.slice(2).join(' ');
        }
      }

      const isExperience = /work history|professional experience|employment|experience/i.test(header);
      const isEducation = /academic background|education/i.test(header);

      if (isExperience || isEducation) {
        const type = isExperience ? 'experience' : 'education';
        
        // If content contains sub-entries delimited by ###
        if (content.includes('###')) {
          const rawEntries = content.split(/\s*###\s+/).map(e => e.trim()).filter(e => e.length > 0);
          for (const raw of rawEntries) {
            // Skip placeholders like "N/A"
            if (/^(n\/a|none|null|undefined)$/i.test(raw)) continue;
            
            const parsed = parseSingleEntry(raw, type);
            if (isValidEntry(parsed, type)) {
              if (type === 'experience') {
                experienceList.push(parsed);
              } else {
                educationList.push(parsed);
              }
            }
          }
        } else {
          // Otherwise split by newlines or bullets
          const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          for (const line of lines) {
            // Strip bullets
            const cleanedLine = line.replace(/^[-•*+]\s+/, '').trim();
            if (/^(n\/a|none|null|undefined)$/i.test(cleanedLine)) continue;
            
            const parsed = parseSingleEntry(cleanedLine, type);
            if (isValidEntry(parsed, type)) {
              if (type === 'experience') {
                experienceList.push(parsed);
              } else {
                educationList.push(parsed);
              }
            }
          }
        }
      }
    }
  } else {
    // Plain line-based text
    const lines = cleanedBio.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    let currentSection: 'experience' | 'education' | 'other' = 'other';
    const sectionLines: { experience: string[]; education: string[] } = {
      experience: [],
      education: []
    };

    for (const line of lines) {
      const cleanedLine = line.replace(/^[-•*+]\s+/, '').trim();
      
      let matchedHeader = '';
      if (/^(?:work\s+history|professional\s+experience|employment|experience)(?:\s+n\/a)?$/i.test(cleanedLine)) {
        matchedHeader = 'experience';
      } else if (/^(?:academic\s+background|education)(?:\s+n\/a)?$/i.test(cleanedLine)) {
        matchedHeader = 'education';
      } else if (/^(?:skills|awards|honors|honors\s+&\s+awards|certifications|about|summary)(?:\s+n\/a)?$/i.test(cleanedLine)) {
        matchedHeader = 'other';
      }

      if (matchedHeader) {
        currentSection = matchedHeader as any;
      } else if (currentSection !== 'other') {
        if (/^(n\/a|none|null|undefined)$/i.test(cleanedLine)) continue;
        sectionLines[currentSection].push(cleanedLine);
      }
    }

    // Process experience lines sequentially
    let currentExp: any = null;
    const expTitlePattern = /leader|manager|developer|engineer|director|analyst|consultant|specialist|head|vp|president|ceo|cto|founder|hrbp|acquisition|recruiter|lead|officer|architect|designer|practitioner/i;
    const expCompanyPattern = /inc|ltd|llc|corp|corporation|company|co\.|destinations|technologies|solutions|systems|services|group|bank|university|labs/i;

    for (const line of sectionLines.experience) {
      const isTitle = expTitlePattern.test(line);
      const isCompany = expCompanyPattern.test(line);
      const yearMatch = line.match(/\b(19\d{2}|20\d{2})\b/);

      if (isTitle) {
        if (currentExp && isValidEntry(currentExp, 'experience')) {
          experienceList.push(currentExp);
        }
        currentExp = { title: line, company: '', period: '', description: '', startYear: '', endYear: '' };
      } else if (currentExp) {
        if (yearMatch) {
          currentExp.period = currentExp.period ? currentExp.period + ' ' + line : line;
          const rangeMatch = line.match(/\b(19\d{2}|20\d{2})\s*(?:-|–|to|\/)\s*(19\d{2}|20\d{2}|Present|Current)\b/i);
          if (rangeMatch) {
            currentExp.startYear = rangeMatch[1];
            if (/\b(19\d{2}|20\d{2})\b/.test(rangeMatch[2])) {
              currentExp.endYear = rangeMatch[2];
            }
          } else {
            const singleMatch = line.match(/\b(19\d{2}|20\d{2})\b/);
            if (singleMatch) {
              currentExp.startYear = singleMatch[1];
              currentExp.endYear = singleMatch[1];
            }
          }
        } else if (isCompany || !currentExp.company) {
          currentExp.company = currentExp.company ? currentExp.company + ' ' + line : line;
        } else {
          currentExp.description = currentExp.description ? currentExp.description + ' ' + line : line;
        }
      } else {
        currentExp = { title: '', company: line, period: '', description: '', startYear: '', endYear: '' };
      }
    }
    if (currentExp && isValidEntry(currentExp, 'experience')) {
      experienceList.push(currentExp);
    }

    // Process education lines sequentially
    let currentEdu: any = null;
    const eduDegreePattern = /\b(b\.?\s*a\.?|m\.?\s*b\.?\s*a\.?|b\.?\s*com\.?|b\.?\s*sc\.?|m\.?\s*sc\.?|b\.?\s*tech\.?|m\.?\s*tech\.?|b\.?\s*e\.?|m\.?\s*e\.?|ph\.?\s*d\.?|doctorate|master|bachelor|diploma|degree|associate)\b/i;
    const eduSchoolPattern = /\b(college|university|school|institute|academy|polytechnic|tech)\b/i;

    for (const line of sectionLines.education) {
      const isSchool = eduSchoolPattern.test(line);
      const isDegree = eduDegreePattern.test(line);
      const yearMatch = line.match(/\b(19\d{2}|20\d{2})\b/);

      const isNewEntry = isSchool || (isDegree && currentEdu && currentEdu.degree) || (!currentEdu);

      if (isNewEntry) {
        if (currentEdu && isValidEntry(currentEdu, 'education')) {
          educationList.push(currentEdu);
        }
        currentEdu = {
          school: isSchool ? line : '',
          degree: isDegree ? line : '',
          fieldOfStudy: '',
          year: '',
          startYear: '',
          endYear: '',
          description: ''
        };
      } else if (currentEdu) {
        if (yearMatch) {
          currentEdu.year = yearMatch[0];
          const rangeMatch = line.match(/\b(19\d{2}|20\d{2})\s*(?:-|–|to|\/)\s*(19\d{2}|20\d{2}|Present|Current)\b/i);
          if (rangeMatch) {
            currentEdu.startYear = rangeMatch[1];
            if (/\b(19\d{2}|20\d{2})\b/.test(rangeMatch[2])) {
              currentEdu.endYear = rangeMatch[2];
              currentEdu.year = rangeMatch[2];
            }
          } else {
            const singleMatch = line.match(/\b(19\d{2}|20\d{2})\b/);
            if (singleMatch) {
              currentEdu.startYear = singleMatch[1];
              currentEdu.endYear = singleMatch[1];
              currentEdu.year = singleMatch[1];
            }
          }
        } else if (isDegree && !currentEdu.degree) {
          currentEdu.degree = line;
        } else if (isSchool && !currentEdu.school) {
          currentEdu.school = line;
        } else if (!currentEdu.fieldOfStudy) {
          currentEdu.fieldOfStudy = line;
        } else {
          currentEdu.description = currentEdu.description ? currentEdu.description + ' ' + line : line;
        }
      }
    }
    if (currentEdu && isValidEntry(currentEdu, 'education')) {
      educationList.push(currentEdu);
    }
  }

  // Clean empty string values in results to match exact keys
  const cleanExp = experienceList.map(exp => {
    const cleaned: ParsedExperience = {};
    if (exp.title) cleaned.title = exp.title.trim();
    if (exp.company) cleaned.company = exp.company.trim();
    if (exp.employmentType) cleaned.employmentType = exp.employmentType.trim();
    if (exp.period) cleaned.period = exp.period.trim();
    if (exp.startYear) cleaned.startYear = exp.startYear.trim();
    if (exp.endYear) cleaned.endYear = exp.endYear.trim();
    if (exp.description) cleaned.description = exp.description.trim();
    return cleaned;
  });

  const cleanEdu = educationList.map(edu => {
    const cleaned: ParsedEducation = {};
    if (edu.school) cleaned.school = edu.school.trim();
    if (edu.degree) cleaned.degree = edu.degree.trim();
    if (edu.fieldOfStudy) cleaned.fieldOfStudy = edu.fieldOfStudy.trim();
    if (edu.year) cleaned.year = edu.year.trim();
    if (edu.startYear) cleaned.startYear = edu.startYear.trim();
    if (edu.endYear) cleaned.endYear = edu.endYear.trim();
    if (edu.description) cleaned.description = edu.description.trim();
    return cleaned;
  });

  return {
    experience: cleanExp,
    education: cleanEdu
  };
}

export function formatGroundedBio(
  bioText: string | null | undefined,
  experienceList?: any[],
  educationList?: any[],
  currentTitle?: string | null,
  currentCompany?: string | null
): string {
  if (!bioText) return '';
  const cleaned = decodeHtmlEntities(bioText).trim();
  if (!cleaned.includes('##') && !cleaned.includes('###')) {
    return cleaned; // Return as is if it's already plain text (like a short summary)
  }

  const parsed = parseBiography(cleaned);

  // Use fallback arrays if the parsed list is empty
  const finalEdu = parsed.education.length > 0 ? parsed.education : (educationList || []);
  let finalExp = parsed.experience.length > 0 ? parsed.experience : (experienceList || []);

  // If experience is empty, build a fallback entry using the current job credentials if available
  if (finalExp.length === 0 && (currentTitle || currentCompany)) {
    finalExp = [{
      title: currentTitle || 'Professional Role',
      company: currentCompany || '',
      period: 'Present'
    }];
  }

  // Extract About/Summary if present
  let aboutText = '';
  const aboutMatch = cleaned.match(/##\s+About\s+([\s\S]*?)(##|$)/i);
  if (aboutMatch && aboutMatch[1]) {
    aboutText = aboutMatch[1].trim();
  }

  const lines: string[] = [];
  if (aboutText) {
    lines.push(`About: ${aboutText}\n`);
  }

  lines.push('Education:');
  if (finalEdu && finalEdu.length > 0) {
    finalEdu.forEach(edu => {
      const parts = [
        edu.school || edu.institution,
        edu.degree,
        edu.fieldOfStudy
      ].filter(Boolean);
      
      const details = parts.join(' - ');
      const period = edu.startYear && edu.endYear 
        ? ` (${edu.startYear} - ${edu.endYear})` 
        : edu.year 
          ? ` (${edu.year})` 
          : '';
      lines.push(`- ${details}${period}`);
    });
  } else {
    lines.push('- N/A');
  }

  lines.push('\nExperience:');
  if (finalExp && finalExp.length > 0) {
    finalExp.forEach(exp => {
      const role = [
        exp.title || exp.designation,
        exp.company ? `at ${exp.company}` : ''
      ].filter(Boolean).join(' ');
      
      const periodStr = exp.period || exp.duration || (exp.startYear && exp.endYear ? `${exp.startYear} - ${exp.endYear}` : '');
      const period = periodStr ? ` (${periodStr})` : '';
      const desc = exp.description ? ` - ${exp.description}` : '';
      lines.push(`- ${role}${period}${desc}`);
    });
  } else {
    lines.push('- N/A');
  }

  return lines.join('\n');
}

