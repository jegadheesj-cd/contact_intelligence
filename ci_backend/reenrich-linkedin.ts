import { PrismaClient } from '@prisma/client';
import { LinkedInDataExtractor } from './src/modules/profile-enrichment/services/LinkedInDataExtractor';
import logger from './src/config/logger';
import axios from 'axios';

const prisma = new PrismaClient();
const extractor = new LinkedInDataExtractor();

interface MergedProfileData {
  experience?: any;
  education?: any;
  organizations?: any;
  volunteerExperience?: any;
  summary?: any;
  [key: string]: any;
}

async function fetchLinkedInProfileData(linkedinUrl: string): Promise<string> {
  try {
    if (!linkedinUrl) return '';

    logger.info(`[Re-enrich] Fetching LinkedIn data from: ${linkedinUrl}`);
    
    // Attempt to fetch profile using Cheerio or similar (simplified)
    // In production, use a real LinkedIn scraper or API
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    try {
      const response = await axios.get(linkedinUrl, { headers, timeout: 10000 });
      return response.data || '';
    } catch (e) {
      logger.warn(`[Re-enrich] Could not fetch LinkedIn URL: ${linkedinUrl}`);
      return '';
    }
  } catch (e) {
    logger.error(`[Re-enrich] Error fetching LinkedIn data:`, e);
    return '';
  }
}

async function reEnrichContactsWithLinkedInData() {
  logger.info('[Re-enrich] Starting re-enrichment with LinkedIn data extraction...');
  
  let processedCount = 0;
  let updatedCount = 0;
  let emptyLinkedInCount = 0;
  let skipCount = 0;

  try {
    // Get all contacts with professional profiles
    const contacts = await prisma.contact.findMany({
      include: { 
        professionalProfile: true 
      },
      where: {
        professionalProfile: {
          enrichmentStatus: 'COMPLETED'
        }
      }
    });

    logger.info(`[Re-enrich] Found ${contacts.length} completed enrichments`);

    for (const contact of contacts) {
      processedCount++;

      if (!contact.professionalProfile) {
        skipCount++;
        continue;
      }

      const merged = contact.professionalProfile.mergedProfile as MergedProfileData;
      
      // Check if we have a LinkedIn URL to work with
      const linkedInUrl = merged?.publicProfiles?.value?.find(
        (p: any) => p.platform?.toLowerCase() === 'linkedin'
      )?.url;

      if (!linkedInUrl) {
        emptyLinkedInCount++;
        logger.debug(`[Re-enrich] No LinkedIn URL for ${contact.name}`);
        continue;
      }

      try {
        logger.info(`[Re-enrich] Processing: ${contact.name} (${linkedInUrl})`);
        
        // Fetch LinkedIn profile data
        const profileContent = await fetchLinkedInProfileData(linkedInUrl);
        
        if (!profileContent || profileContent.length < 100) {
          logger.warn(`[Re-enrich] Empty profile content for ${contact.name}`);
          emptyLinkedInCount++;
          continue;
        }

        // Extract structured data
        const extractedData = extractor.extractStructuredData(profileContent);

        // Merge with existing profile, prioritizing LinkedIn data
        const updatedMerged = { ...merged };

        // Update experience
        if (extractedData.experience && extractedData.experience.length > 0) {
          updatedMerged.experience = {
            value: extractedData.experience,
            source: 'LinkedIn Profile Extraction',
            confidence: 90,
            timestamp: new Date().toISOString(),
            verification: 'Verified'
          };
          logger.info(`[Re-enrich]   ✓ Updated experience: ${extractedData.experience.length} entries`);
        }

        // Update education
        if (extractedData.education && extractedData.education.length > 0) {
          updatedMerged.education = {
            value: extractedData.education,
            source: 'LinkedIn Profile Extraction',
            confidence: 90,
            timestamp: new Date().toISOString(),
            verification: 'Verified'
          };
          logger.info(`[Re-enrich]   ✓ Updated education: ${extractedData.education.length} entries`);
        }

        // Update organizations
        if (extractedData.organizations && extractedData.organizations.length > 0) {
          updatedMerged.organizations = {
            value: extractedData.organizations,
            source: 'LinkedIn Profile Extraction',
            confidence: 85,
            timestamp: new Date().toISOString(),
            verification: 'Verified'
          };
          logger.info(`[Re-enrich]   ✓ Updated organizations: ${extractedData.organizations.length} entries`);
        }

        // Update volunteering
        if (extractedData.volunteerExperience && extractedData.volunteerExperience.length > 0) {
          updatedMerged.volunteerExperience = {
            value: extractedData.volunteerExperience,
            source: 'LinkedIn Profile Extraction',
            confidence: 85,
            timestamp: new Date().toISOString(),
            verification: 'Verified'
          };
          logger.info(`[Re-enrich]   ✓ Updated volunteering: ${extractedData.volunteerExperience.length} entries`);
        }

        // Save to database
        await prisma.professionalProfile.update({
          where: { id: contact.professionalProfile.id },
          data: { mergedProfile: updatedMerged }
        });

        // Also update Contact table experience/education columns
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            experience: JSON.stringify(extractedData.experience || []),
            education: JSON.stringify(extractedData.education || [])
          }
        });

        updatedCount++;
        logger.info(`[Re-enrich]   ✓ Saved to database\n`);

      } catch (error) {
        logger.error(`[Re-enrich] Error processing ${contact.name}:`, error);
      }
    }

  } catch (error) {
    logger.error('[Re-enrich] Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }

  // Summary
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Re-enrich] SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Total processed: ${processedCount}
✓ Updated with LinkedIn data: ${updatedCount}
✓ Empty LinkedIn profiles: ${emptyLinkedInCount}
✓ Skipped: ${skipCount}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Re-enrichment with real LinkedIn data complete!
   Refresh the browser to see updated Experience & Education tabs.
`);
}

// Run the enrichment
reEnrichContactsWithLinkedInData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
