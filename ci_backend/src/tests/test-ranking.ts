import { SearchRankingEngine } from '../modules/profile-enrichment/services/SearchRankingEngine';
import { CandidateProfile } from '../modules/profile-enrichment/services/ProfileDiscoveryEngine';

const engine = new SearchRankingEngine();

const signals = {
  name: "Jegadhees J",
  company: "Cloud Destinations",
  designation: "Software Engineer Intern",
  email: "jegadhees@clouddestinations.com",
  phone: "1234567890",
  website: "clouddestinations.com",
  address: "India",
  companyDomain: "clouddestinations.com",
  websiteDomain: "clouddestinations.com"
};

const candidate: CandidateProfile = {
  fullName: "Jegadhees J",
  company: "Cloud Destinations",
  designation: "Software Engineer Intern",
  experience: [],
  education: [],
  skills: [],
  projects: [],
  publicProfiles: [{ platform: "LinkedIn", url: "https://linkedin.com/in/jegadheesj" }],
  source: "LinkedIn URL Discovery",
  sourceConfidence: 80,
};

const ranked = engine.rankCandidates(signals, [candidate]);
console.log(ranked[0].sourceConfidence);
console.log((ranked[0] as any).verificationReasons);
