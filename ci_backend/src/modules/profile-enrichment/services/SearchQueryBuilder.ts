import { IdentitySignals } from './IdentityResolver';

export class SearchQueryBuilder {
  /**
   * Generates intelligent, general search queries for the Search Intelligence Engine.
   */
  public buildGeneralQueries(signals: IdentitySignals): string[] {
    const { name, company } = signals;
    if (name && company) return [`"${name}" "${company}"`];
    if (name) return [`"${name}"`];
    return [];
  }

  public buildLinkedInQueries(signals: IdentitySignals): string[] {
    const { name, company } = signals;
    const queries: string[] = [];
    if (name && company) {
      queries.push(`site:linkedin.com/in "${name}" "${company}"`);
      queries.push(`site:linkedin.com/in ${name} ${company}`);
    } else if (name) {
      queries.push(`site:linkedin.com/in "${name}"`);
      queries.push(`site:linkedin.com/in ${name}`);
    } else if (company) {
      queries.push(`site:linkedin.com/in "${company}"`);
    }
    return queries;
  }

  public buildGitHubQueries(signals: IdentitySignals): string[] {
    const { name, company, email } = signals;
    const queries: string[] = [];
    if (name) {
      if (company) {
        queries.push(`site:github.com "${name}" "${company}"`);
        queries.push(`site:github.com ${name} ${company}`);
      } else if (email) {
        queries.push(`site:github.com "${name}" "${email}"`);
        queries.push(`site:github.com ${name} ${email}`);
      } else {
        queries.push(`site:github.com "${name}"`);
        queries.push(`site:github.com ${name}`);
      }
    }
    return queries;
  }

  public buildCompanyQueries(signals: IdentitySignals): string[] {
    const { company } = signals;
    if (company) {
      return [
        `"${company}" official website`,
        `"${company}" about us`,
        `"${company}" leadership`,
        `"${company}" team`,
        `"${company}" company`
      ];
    }
    return [];
  }

  public buildInstagramQueries(signals: IdentitySignals): string[] {
    const { name, company } = signals;
    if (name && company) return [`site:instagram.com "${name}" "${company}"`];
    if (name) return [`site:instagram.com "${name}"`];
    return [];
  }

  public buildFacebookQueries(signals: IdentitySignals): string[] {
    const { name, company } = signals;
    if (name && company) return [`site:facebook.com "${name}" "${company}"`];
    if (name) return [`site:facebook.com "${name}"`];
    return [];
  }

  public buildTwitterQueries(signals: IdentitySignals): string[] {
    const { name, company } = signals;
    if (name && company) return [`site:x.com "${name}" "${company}"`];
    if (name) return [`site:x.com "${name}"`];
    return [];
  }
}
