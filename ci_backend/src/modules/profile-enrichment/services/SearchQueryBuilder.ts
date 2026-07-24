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
    if (name && company) return [`site:linkedin.com/in "${name}" "${company}"`];
    if (name) return [`site:linkedin.com/in "${name}"`];
    if (company) return [`site:linkedin.com/in "${company}"`];
    return [];
  }

  public buildGitHubQueries(signals: IdentitySignals): string[] {
    const { name, company, email } = signals;
    if (name) {
      if (company) return [`site:github.com "${name}" "${company}"`];
      if (email) return [`site:github.com "${name}" "${email}"`];
      return [`site:github.com "${name}"`];
    }
    return [];
  }

  public buildCompanyQueries(signals: IdentitySignals): string[] {
    const { name, company } = signals;
    if (company) {
      if (name) return [`"${company}" "${name}" team OR leadership`];
      return [`"${company}" website`];
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
