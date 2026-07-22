import { IdentitySignals } from './IdentityResolver';

export class SearchQueryBuilder {
  public buildLinkedInQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const { name, company, email, phone, website, companyDomain, address } = signals;

    if (name) {
      if (email) queries.push(`site:linkedin.com/in "${name}" "${email}"`);
      if (phone) queries.push(`site:linkedin.com/in "${name}" "${phone}"`);
      if (company) {
        queries.push(`site:linkedin.com/in "${name}" "${company}"`);
        queries.push(`"${name}" "${company}" linkedin`);
      }
      if (companyDomain) queries.push(`site:linkedin.com/in "${name}" "${companyDomain}"`);
      if (website) queries.push(`site:linkedin.com/in "${name}" "${website}"`);
      if (address) queries.push(`site:linkedin.com/in "${name}" "${address}"`);
      
      queries.push(`site:linkedin.com/in "${name}"`);
      queries.push(`"${name}" linkedin`);
      queries.push(name);
    } else if (company) {
      queries.push(`site:linkedin.com/in "${company}"`);
    }
    return queries;
  }

  public buildGitHubQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const { name, company, email, website, companyDomain } = signals;

    if (name) {
      if (email) queries.push(`site:github.com "${name}" "${email}"`);
      if (company) {
        queries.push(`site:github.com "${name}" "${company}"`);
        queries.push(`"${name}" "${company}" github`);
      }
      queries.push(`site:github.com "${name}"`);
      queries.push(`"${name}" github`);
      queries.push(name);
    }
    if (companyDomain) {
      queries.push(`site:github.com "${companyDomain}"`);
      queries.push(`"${companyDomain}" github`);
    }
    if (website) {
      queries.push(`site:github.com "${website}"`);
    }
    return queries;
  }

  public buildCompanyQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const company = signals.company;
    const name = signals.name;
    
    if (company) {
      if (name) queries.push(`"${company}" "${name}" about team leadership`);
      queries.push(`"${company}" about team leadership`);
      queries.push(`"${company}" website`);
    }
    return queries;
  }

  public buildInstagramQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const { name, company, email, address } = signals;

    if (name) {
      if (email) queries.push(`site:instagram.com "${name}" "${email}"`);
      if (company) queries.push(`site:instagram.com "${name}" "${company}"`);
      if (address) queries.push(`site:instagram.com "${name}" "${address}"`);
      queries.push(`site:instagram.com "${name}"`);
    }
    return queries;
  }

  public buildFacebookQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const { name, company, address } = signals;

    if (name) {
      if (company) queries.push(`site:facebook.com "${name}" "${company}"`);
      if (address) queries.push(`site:facebook.com "${name}" "${address}"`);
      queries.push(`site:facebook.com "${name}"`);
    }
    return queries;
  }

  public buildTwitterQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const { name, company, email, website } = signals;

    if (name) {
      if (email) {
        queries.push(`site:x.com "${name}" "${email}"`);
        queries.push(`site:twitter.com "${name}" "${email}"`);
      }
      if (company) {
        queries.push(`site:x.com "${name}" "${company}"`);
        queries.push(`site:twitter.com "${name}" "${company}"`);
      }
      if (website) {
        queries.push(`site:x.com "${name}" "${website}"`);
      }
      queries.push(`site:x.com "${name}"`);
      queries.push(`site:twitter.com "${name}"`);
    }
    return queries;
  }
}
