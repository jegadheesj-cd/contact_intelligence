export interface ILinkedInService {
  searchProfiles(name: string, company?: string): Promise<any>;
  getProfileDetails(profileId: string): Promise<any>;
}
