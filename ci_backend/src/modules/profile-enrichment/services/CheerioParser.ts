import * as cheerio from 'cheerio';
import logger from '../../../config/logger';

export interface CompanyScrapedData {
  companyName?: string;
  about?: string;
  leadership?: Array<{ name: string; designation?: string; department?: string }>;
  offices?: string[];
  contactDetails?: { email?: string; phone?: string };
}

export interface PortfolioScrapedData {
  projects?: Array<{ name: string; description?: string; technologies?: string[] }>;
  skills?: string[];
  experience?: Array<{ title: string; company?: string; period?: string }>;
  education?: Array<{ school: string; degree?: string; year?: string }>;
  technologies?: string[];
  socialLinks?: string[];
}

export interface BlogScrapedData {
  posts?: Array<{ title: string; link?: string; date?: string }>;
  bio?: string;
}

export class CheerioParser {
  /**
   * Safe fetch helper to download page HTML with abort timeout.
   */
  public async fetchHtml(url: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (e: any) {
      logger.warn(`[CheerioParser] Fetch error for URL ${url}: ${e.message}`);
      throw e;
    }
  }

  /**
   * Parse company website layout details.
   */
  public parseCompanyWebsite(html: string, nameSearch?: string): CompanyScrapedData {
    const $ = cheerio.load(html);
    const text = $('body').text();

    const companyName = $('title').text().split('|')[0].split('-')[0].trim() || $('h1').first().text().trim();
    
    // Scrape About section
    let about = '';
    $('p, section, div').each((_, el) => {
      const elText = $(el).text().trim();
      const lower = elText.toLowerCase();
      if ((lower.includes('about us') || lower.includes('who we are') || lower.includes('our mission')) && elText.length > 50 && elText.length < 400 && !about) {
        about = elText;
      }
    });

    if (!about) {
      about = text.substring(0, 300).replace(/\s+/g, ' ').trim();
    }

    // Scrape leadership team
    const leadership: Array<{ name: string; designation?: string; department?: string }> = [];
    $('h1, h2, h3, h4, h5, h6, .member-name, .team-name, .leadership-name').each((_, el) => {
      const leaderName = $(el).text().trim();
      // Heuristic: check if this looks like a full name (2-3 words) and does not contain generic verbs
      if (leaderName.split(/\s+/).length >= 2 && leaderName.split(/\s+/).length <= 4 && !/about|contact|career|home|services|portfolio|blog/i.test(leaderName)) {
        const parent = $(el).parent();
        const designation = parent.find('.title, .role, .position, .designation, p').first().text().trim();
        if (designation && designation.length < 60) {
          leadership.push({
            name: leaderName,
            designation,
          });
        }
      }
    });

    // Scrape Office locations
    const offices: string[] = [];
    $('address, .office, .location, .address').each((_, el) => {
      const addr = $(el).text().replace(/\s+/g, ' ').trim();
      if (addr.length > 10 && addr.length < 200 && !offices.includes(addr)) {
        offices.push(addr);
      }
    });

    // Scrape Contact Details
    let email = '';
    let phone = '';
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) email = emailMatch[0];

    const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) phone = phoneMatch[0];

    return {
      companyName,
      about: about.slice(0, 500),
      leadership: leadership.slice(0, 10),
      offices: offices.slice(0, 3),
      contactDetails: { email, phone },
    };
  }

  /**
   * Parse portfolios, resumes, speaker listings.
   */
  public parsePortfolio(html: string): PortfolioScrapedData {
    const $ = cheerio.load(html);
    
    // Skills & Technologies
    const skills: string[] = [];
    const technologies: string[] = [];
    $('.skills span, .skill, .tag, .badge, li').each((_, el) => {
      const skill = $(el).text().trim();
      if (skill && skill.length < 25 && skill.length > 2 && !/home|about|portfolio|contact/i.test(skill)) {
        if (skills.length < 15 && !skills.includes(skill)) {
          skills.push(skill);
        }
      }
    });

    // Projects
    const projects: Array<{ name: string; description?: string; technologies?: string[] }> = [];
    $('.project, .work-item, .portfolio-item, h3').each((_, el) => {
      const pName = $(el).text().trim();
      if (pName && pName.length > 3 && pName.length < 60 && projects.length < 8) {
        const parent = $(el).parent();
        const desc = parent.find('p, .description').first().text().trim();
        projects.push({
          name: pName,
          description: desc ? desc.slice(0, 150) : undefined,
        });
      }
    });

    // Experience
    const experience: Array<{ title: string; company?: string; period?: string }> = [];
    $('.experience-item, .job, .position').each((_, el) => {
      const title = $(el).find('h4, .title').text().trim() || $(el).text().trim();
      if (title && title.length < 80) {
        const company = $(el).find('.company, .organization').text().trim();
        const period = $(el).find('.date, .period, .duration').text().trim();
        experience.push({ title, company, period });
      }
    });

    // Education
    const education: Array<{ school: string; degree?: string; year?: string }> = [];
    $('.education-item, .school, .degree').each((_, el) => {
      const school = $(el).find('h4, .school').text().trim() || $(el).text().trim();
      if (school && school.length < 100) {
        const degree = $(el).find('.degree, .major').text().trim();
        const year = $(el).find('.date, .year').text().trim();
        education.push({ school, degree, year });
      }
    });

    // Social profile Links
    const socialLinks: string[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('github.com/') || href.includes('linkedin.com/in/') || href.includes('twitter.com/') || href.includes('medium.com/'))) {
        if (!socialLinks.includes(href)) {
          socialLinks.push(href);
        }
      }
    });

    return {
      skills: skills.slice(0, 15),
      technologies: technologies.slice(0, 15),
      projects,
      experience: experience.slice(0, 5),
      education: education.slice(0, 3),
      socialLinks: socialLinks.slice(0, 5),
    };
  }

  /**
   * Parse Medium, Dev.to blog listings.
   */
  public parseBlog(html: string): BlogScrapedData {
    const $ = cheerio.load(html);
    const posts: Array<{ title: string; link?: string; date?: string }> = [];

    // Medium or Dev.to posts extraction
    $('article, .post, .article, h2, h3').each((_, el) => {
      const title = $(el).text().trim();
      if (title && title.length > 10 && title.length < 120 && posts.length < 5) {
        const link = $(el).find('a').attr('href') || $(el).attr('href');
        const date = $(el).find('time, .date').text().trim();
        posts.push({ title, link, date });
      }
    });

    let bio = $('.bio, .about-author, .profile-description').text().trim();
    if (!bio) {
      bio = $('meta[name="description"]').attr('content') || '';
    }

    return {
      posts,
      bio: bio ? bio.slice(0, 300) : undefined,
    };
  }
}
