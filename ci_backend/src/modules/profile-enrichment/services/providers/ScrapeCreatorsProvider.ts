import logger from '../../../../config/logger';
import { env } from '../../../../config/env';
import { CandidateProfile } from '../ProfileDiscoveryEngine';

export interface ScrapeCreatorsProfileData {
  platform: 'Facebook' | 'Instagram' | 'YouTube';
  profileUrl: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  postCount?: number;
  verified?: boolean;
  profileImageUrl?: string;
  coverImageUrl?: string;
  publicPhotos?: string[];
  publicWebsite?: string;
  category?: string;
  location?: string;
  channelInfo?: any;
  posts?: any[];
  publicMetadata?: any;
}

export class ScrapeCreatorsProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.apiKey = env.SCRAPECREATORS_API_KEY || '';
    this.baseUrl = env.SCRAPECREATORS_BASE_URL || 'https://api.scrapecreators.com';
    this.timeoutMs = env.SCRAPECREATORS_TIMEOUT || 15000;
  }

  /**
   * Check if ScrapeCreators API credentials are set up.
   */
  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Helper to perform HTTP request with configured timeout.
   */
  private async executeGet(endpointPath: string, params: Record<string, string>): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${endpointPath}?${query}`;
    
    logger.info(`[ScrapeCreators] Calling URL: ${url}`);
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(id);
      
      if (!response.ok) {
        throw new Error(`ScrapeCreators API error: ${response.status} ${response.statusText}`);
      }
      
      const json = await response.json();
      return json;
    } catch (err: any) {
      clearTimeout(id);
      logger.error(`[ScrapeCreators] Request failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Scrapes Instagram profile data.
   */
  public async scrapeInstagram(handleOrUrl: string): Promise<ScrapeCreatorsProfileData | null> {
    let handle = handleOrUrl.trim();
    
    // Extract handle if full URL is passed
    if (handle.includes('instagram.com/')) {
      const match = handle.match(/instagram\.com\/([^/?#]+)/i);
      if (match && match[1]) {
        handle = match[1];
      }
    }
    
    if (handle.startsWith('@')) {
      handle = handle.substring(1);
    }
    
    if (!handle) return null;
    
    try {
      logger.info(`[ScrapeCreators] Fetching Instagram profile for handle: ${handle}`);
      const rawData = await this.executeGet('/v1/instagram/profile', { handle });
      
      if (!rawData) return null;
      
      const user = rawData.user || rawData.data || rawData;
      
      const mapped: ScrapeCreatorsProfileData = {
        platform: 'Instagram',
        profileUrl: `https://instagram.com/${handle}`,
        username: handle,
        displayName: user.full_name || user.fullName || user.display_name || user.name || handle,
        bio: user.biography || user.bio || user.about || '',
        followersCount: user.followers_count || user.followersCount || (user.edge_followed_by && user.edge_followed_by.count) || 0,
        followingCount: user.following_count || user.followingCount || (user.edge_follow && user.edge_follow.count) || 0,
        postCount: user.posts_count || user.postsCount || (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count) || 0,
        verified: user.is_verified || user.verified || false,
        profileImageUrl: user.profile_pic_url_hd || user.profile_pic_url || user.profile_image_url || user.profileImageUrl || '',
        publicWebsite: user.external_url || user.externalUrl || user.website || '',
        category: user.category_name || user.category || '',
        publicMetadata: rawData,
      };
      
      return mapped;
    } catch (err: any) {
      logger.warn(`[ScrapeCreators] Instagram scraping failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Scrapes Facebook profile data.
   */
  public async scrapeFacebook(url: string): Promise<ScrapeCreatorsProfileData | null> {
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://${targetUrl}`;
    }
    
    try {
      logger.info(`[ScrapeCreators] Fetching Facebook profile for URL: ${targetUrl}`);
      const rawData = await this.executeGet('/v1/facebook/profile', { url: targetUrl });
      
      if (!rawData) return null;
      
      const fb = rawData.data || rawData;
      
      // Attempt to parse username/handle from profile URL
      let username = '';
      const fbUrlMatch = targetUrl.match(/facebook\.com\/([^/?#]+)/i);
      if (fbUrlMatch && fbUrlMatch[1] && !['profile.php', 'people'].includes(fbUrlMatch[1])) {
        username = fbUrlMatch[1];
      }
      
      const mapped: ScrapeCreatorsProfileData = {
        platform: 'Facebook',
        profileUrl: targetUrl,
        username: username || undefined,
        displayName: fb.name || fb.title || fb.displayName || '',
        bio: fb.about || fb.bio || fb.description || fb.biography || '',
        followersCount: fb.followers || fb.follower_count || fb.followersCount || fb.likes || fb.like_count || 0,
        followingCount: fb.following || fb.followingCount || 0,
        verified: fb.verified || fb.is_verified || false,
        profileImageUrl: fb.profile_picture || fb.profile_pic || fb.avatar || fb.profileImageUrl || '',
        coverImageUrl: fb.cover_photo || fb.cover || fb.coverImageUrl || '',
        location: fb.location || '',
        publicMetadata: rawData,
      };
      
      return mapped;
    } catch (err: any) {
      logger.warn(`[ScrapeCreators] Facebook scraping failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Scrapes YouTube channel data.
   */
  public async scrapeYouTube(handleOrUrl: string): Promise<ScrapeCreatorsProfileData | null> {
    let queryVal = handleOrUrl.trim();
    const params: Record<string, string> = {};
    
    if (queryVal.includes('youtube.com/') || queryVal.includes('youtu.be/')) {
      params.url = queryVal;
    } else {
      let handle = queryVal;
      if (!handle.startsWith('@')) {
        handle = `@${handle}`;
      }
      params.handle = handle;
    }
    
    try {
      logger.info(`[ScrapeCreators] Fetching YouTube channel for query: ${JSON.stringify(params)}`);
      const rawData = await this.executeGet('/v1/youtube/channel', params);
      
      if (!rawData) return null;
      
      const yt = rawData.data || rawData.channel || rawData;
      
      const mapped: ScrapeCreatorsProfileData = {
        platform: 'YouTube',
        profileUrl: params.url || yt.url || `https://youtube.com/${params.handle || yt.handle || ''}`,
        username: yt.handle || params.handle || '',
        displayName: yt.title || yt.name || yt.displayName || '',
        bio: yt.description || yt.bio || yt.about || '',
        followersCount: yt.subscriber_count || yt.subscribers || yt.subscriberCount || 0,
        verified: yt.verified || yt.is_verified || false,
        profileImageUrl: yt.avatar || yt.thumbnail || yt.profile_image || yt.profileImageUrl || '',
        coverImageUrl: yt.banner || yt.cover || yt.bannerUrl || '',
        channelInfo: yt,
        publicMetadata: rawData,
      };
      
      return mapped;
    } catch (err: any) {
      logger.warn(`[ScrapeCreators] YouTube scraping failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Orchestrates the optional enrichment call for available handles.
   * Maps results into a standard CandidateProfile shape so that they flow into the existing merge pipeline.
   */
  public async enrichProfile(socialUrls: { instagram?: string; facebook?: string; youtube?: string }): Promise<CandidateProfile[]> {
    if (!this.isConfigured()) {
      logger.info('[ScrapeCreators] API Key not configured. Skipping ScrapeCreators enrichment.');
      return [];
    }

    const discoveredProfiles: CandidateProfile[] = [];

    // 1. Instagram Enrichment
    if (socialUrls.instagram) {
      const data = await this.scrapeInstagram(socialUrls.instagram);
      if (data) {
        discoveredProfiles.push(this.mapToCandidateProfile(data));
      }
    }

    // 2. Facebook Enrichment
    if (socialUrls.facebook) {
      const data = await this.scrapeFacebook(socialUrls.facebook);
      if (data) {
        discoveredProfiles.push(this.mapToCandidateProfile(data));
      }
    }

    // 3. YouTube Enrichment
    if (socialUrls.youtube) {
      const data = await this.scrapeYouTube(socialUrls.youtube);
      if (data) {
        discoveredProfiles.push(this.mapToCandidateProfile(data));
      }
    }

    return discoveredProfiles;
  }

  /**
   * Helper to map ScrapeCreatorsProfileData to standard CandidateProfile structure.
   */
  private mapToCandidateProfile(data: ScrapeCreatorsProfileData): CandidateProfile {
    return {
      fullName: data.displayName || data.username || 'Social Profile',
      headline: data.category || `${data.platform} Profile`,
      summary: data.bio || '',
      location: data.location || '',
      profileImage: data.profileImageUrl || '',
      experience: [],
      education: [],
      skills: [],
      projects: [],
      publicProfiles: [
        {
          platform: data.platform,
          url: data.profileUrl,
          confidence: 85,
        }
      ],
      // Inject raw scrape data so it passes cleanly into database dumps
      scrapeCreatorsData: data,
      source: `ScrapeCreators - ${data.platform}`,
      sourceConfidence: 55, // Lower confidence as per priority: OCR > LinkedIn > Company > ScrapeCreators
      verificationStatus: 'Unverified',
    } as any;
  }
}
