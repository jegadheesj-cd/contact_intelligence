import prisma from './src/config/db';
import { BiographyExtractionEngine } from './src/modules/profile-enrichment/services/BiographyExtractionEngine';
import logger from './src/config/logger';

async function reExtractProfiles() {
  try {
    const engine = new BiographyExtractionEngine();

    // Find all contacts with completed enrichment
    const contacts = await prisma.contact.findMany({
      where: {
        professionalProfile: {
          enrichmentStatus: 'COMPLETED'
        }
      },
      include: {
        professionalProfile: true,
      },
    });

    logger.info(`Found ${contacts.length} completed profiles to process`);

    let updatedCount = 0;
    let emptyCount = 0;

    for (const contact of contacts) {
      if (!contact.professionalProfile) continue;
      
      const mp = contact.professionalProfile.mergedProfile as any;
      if (!mp) continue;

      const summary = mp.summary?.value || '';
      if (!summary || summary.length < 20) {
        emptyCount++;
        continue;
      }

      // Extract data
      const extracted = engine.extractFromBiography(summary);

      let hasChanges = false;
      
      // Update experience if empty
      if ((!mp.experience?.value || mp.experience.value.length === 0) && extracted.experience.length > 0) {
        mp.experience = {
          value: extracted.experience,
          source: 'Biography Extraction',
          confidence: 65,
          timestamp: new Date().toISOString(),
          verification: 'Unverified'
        };
        hasChanges = true;
        logger.info(`  ${contact.name}: Added ${extracted.experience.length} experience entries`);
      }

      // Update education if empty
      if ((!mp.education?.value || mp.education.value.length === 0) && extracted.education.length > 0) {
        mp.education = {
          value: extracted.education,
          source: 'Biography Extraction',
          confidence: 65,
          timestamp: new Date().toISOString(),
          verification: 'Unverified'
        };
        hasChanges = true;
        logger.info(`  ${contact.name}: Added ${extracted.education.length} education entries`);
      }

      // Update organizations if empty
      if ((!mp.organizations?.value || mp.organizations.value.length === 0) && extracted.organizations.length > 0) {
        mp.organizations = {
          value: extracted.organizations,
          source: 'Biography Extraction',
          confidence: 60,
          timestamp: new Date().toISOString(),
          verification: 'Unverified'
        };
        hasChanges = true;
        logger.info(`  ${contact.name}: Added ${extracted.organizations.length} organization entries`);
      }

      // Update volunteerExperience if empty
      if ((!mp.volunteerExperience?.value || mp.volunteerExperience.value.length === 0) && extracted.volunteerExperience.length > 0) {
        mp.volunteerExperience = {
          value: extracted.volunteerExperience,
          source: 'Biography Extraction',
          confidence: 60,
          timestamp: new Date().toISOString(),
          verification: 'Unverified'
        };
        hasChanges = true;
        logger.info(`  ${contact.name}: Added ${extracted.volunteerExperience.length} volunteer entries`);
      }

      if (hasChanges) {
        // Save back to database
        await prisma.professionalProfile.update({
          where: { id: contact.professionalProfile.id },
          data: {
            mergedProfile: mp,
          }
        });

        // Also update contact table with extracted data
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            experience: mp.experience?.value || null,
            education: mp.education?.value || null,
          }
        });

        updatedCount++;
      }
    }

    logger.info(`\n✓ Re-extraction complete!`);
    logger.info(`  Updated: ${updatedCount} profiles`);
    logger.info(`  Empty summary: ${emptyCount} profiles`);
    logger.info(`  Not processed: ${contacts.length - updatedCount - emptyCount} profiles`);

  } catch (err: any) {
    logger.error(`Error: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

reExtractProfiles();
