import logger from '../../../config/logger';

export interface IdentitySignals {
  name: string;
  company: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  companyDomain: string | null;
  websiteDomain: string | null;
}

export class IdentityResolver {
  public resolve(contact: any): IdentitySignals {
    logger.info(`[IdentityResolver] Resolving identity signals for contact: ${contact.name}`);

    const name = contact.name || 'Unknown';
    const company = contact.company || null;
    const designation = contact.designation || null;
    const email = contact.email || null;
    const phone = contact.phone || null;
    const website = contact.website || null;
    const address = contact.address || null;

    // Extract domains
    const companyDomain = this.extractDomainFromEmail(email);
    const websiteDomain = this.extractDomainFromWebsite(website);

    const signals: IdentitySignals = {
      name,
      company,
      designation,
      email,
      phone,
      website,
      address,
      companyDomain,
      websiteDomain
    };

    logger.info(`[IdentityResolver] Identity Signals: ${JSON.stringify(signals)}`);
    return signals;
  }

  private extractDomainFromEmail(email: string | null): string | null {
    if (!email) return null;
    const parts = email.trim().toLowerCase().split('@');
    if (parts.length < 2) return null;
    const domain = parts[1];
    
    // Ignore generic domains
    const genericDomains = new Set([
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
      'icloud.com', 'zoho.com', 'protonmail.com', 'mail.com', 'yandex.com'
    ]);
    
    return genericDomains.has(domain) ? null : domain;
  }

  private extractDomainFromWebsite(website: string | null): string | null {
    if (!website) return null;
    try {
      let hostname = website.trim().toLowerCase();
      if (!hostname.startsWith('http://') && !hostname.startsWith('https://')) {
        hostname = 'https://' + hostname;
      }
      const parsed = new URL(hostname);
      let host = parsed.hostname;
      if (host.startsWith('www.')) {
        host = host.substring(4);
      }
      return host;
    } catch (e) {
      return null;
    }
  }
}
