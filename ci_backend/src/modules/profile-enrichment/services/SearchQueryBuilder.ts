import { IdentitySignals } from './IdentityResolver';

export class SearchQueryBuilder {
  public buildLinkedInQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const name = signals.name;
    const company = signals.company;
    const designation = signals.designation;

    if (name && company) {
      queries.push(`site:linkedin.com/in "${name}" "${company}"`);
      queries.push(`"${name}" "${company}" linkedin`);
    }
    if (name && designation) {
      queries.push(`site:linkedin.com/in "${name}" "${designation}"`);
      queries.push(`"${name}" "${designation}" linkedin`);
    }
    if (name) {
      queries.push(`site:linkedin.com/in "${name}"`);
      queries.push(`"${name}" linkedin`);
      queries.push(name); // Plain name fallback
    }
    return queries;
  }

  public buildGitHubQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const name = signals.name;
    const company = signals.company;

    if (name && company) {
      queries.push(`site:github.com "${name}" "${company}"`);
      queries.push(`"${name}" "${company}" github`);
    }
    if (name) {
      queries.push(`site:github.com "${name}"`);
      queries.push(`"${name}" github`);
      queries.push(name); // Plain name fallback
    }
    if (signals.companyDomain) {
      queries.push(`site:github.com "${signals.companyDomain}"`);
      queries.push(`"${signals.companyDomain}" github`);
    }
    if (signals.website) {
      queries.push(`site:github.com "${signals.website}"`);
      queries.push(`"${signals.website}" github`);
    }
    return queries;
  }

  public buildCompanyQueries(signals: IdentitySignals): string[] {
    const queries: string[] = [];
    const company = signals.company;
    if (company) {
      queries.push(`"${company}" about team leadership`);
      queries.push(`"${company}" website`);
    }
    return queries;
  }
}
