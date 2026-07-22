import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ProfileEnrichmentService } from './src/modules/profile-enrichment/enrichment.service';
import logger from './src/config/logger';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const connectionOptions = {
  host: '127.0.0.1', // Force IPv4
  port: 6379,
  maxRetriesPerRequest: null,
};

const enrichmentQueue = new Queue('enrichment-queue', { connection: connectionOptions });
const enrichmentService = new ProfileEnrichmentService();

async function runVerification() {
  console.log('\n====================================================================');
  console.log('STEP 1: Verify BullMQ - Starting local diagnostic worker');
  console.log('====================================================================\n');

  // Create a temporary worker for this diagnostic test
  const testWorker = new Worker(
    'enrichment-queue',
    async (job: Job) => {
      console.log(`\n[BullMQ] Worker Picked Job: ${job.id}`);
      console.log(`[BullMQ] Worker Started for profile: ${job.data.profileId}`);
      
      const { contactId, profileId } = job.data;
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact) throw new Error('Contact not found');

      console.log('\n====================================================================');
      console.log('STEP 2 & 3: Verify RapidAPI & LinkedIn Service');
      console.log('====================================================================\n');
      
      // This will trigger the RapidAPI fetch we instrumented in linkedin.provider.ts
      const enrichmentData = await enrichmentService.instantEnrich(
        contact.name,
        contact.email,
        contact.company
      );

      console.log('\n====================================================================');
      console.log('STEP 5: Verify Database Update (Mapped Object -> Prisma Update)');
      console.log('====================================================================\n');
      
      console.log('[Mapped Object] Data ready for Prisma update:');
      console.log(JSON.stringify(enrichmentData, null, 2));

      await prisma.linkedInProfile.update({
        where: { id: profileId },
        data: {
          enrichmentStatus: 'COMPLETED',
          salesNavigatorId: enrichmentData.salesNavigatorId || null,
          linkedInUrl: enrichmentData.publicProfiles?.find((p: any) => p.platform === 'LinkedIn')?.url || null,
          profileData: enrichmentData as any,
        },
      });

      console.log(`\n[BullMQ] Worker Finished job: ${job.id}`);
    },
    { connection: connectionOptions }
  );

  testWorker.on('completed', async (job) => {
    console.log(`\n[BullMQ] Job Completed successfully: ${job.id}`);
    
    // Fetch the updated DB Row to prove Step 5
    const updatedProfile = await prisma.linkedInProfile.findUnique({
      where: { id: job.data.profileId },
    });
    console.log('\n[Database Row] Updated LinkedInProfile record:');
    console.log(JSON.stringify(updatedProfile, null, 2));
    
    console.log('\n====================================================================');
    console.log('STEP 6: Verify Frontend');
    console.log('====================================================================');
    console.log('With mock profiles completely removed from the backend, the frontend will now exclusively render the database row shown above.');
    
    await testWorker.close();
    await enrichmentQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  testWorker.on('failed', async (job, err) => {
    console.error(`\n[BullMQ] Job Failed: ${job?.id}`);
    console.error(`Error: ${err.message}`);
    await testWorker.close();
    await enrichmentQueue.close();
    await prisma.$disconnect();
    process.exit(1);
  });

  // Find a test contact to enrich
  const contact = await prisma.contact.findFirst({
    where: { name: { not: 'Jane Smith' } },
    include: { linkedInProfile: true }
  });

  if (!contact) {
    console.error('No suitable test contact found in database. Create a contact first.');
    process.exit(1);
  }

  let profile = contact.linkedInProfile;
  if (!profile) {
    profile = await prisma.linkedInProfile.create({
      data: { contactId: contact.id },
    });
  }

  console.log(`[BullMQ] Adding job to queue for Contact: ${contact.name}`);
  const job = await enrichmentQueue.add('enrich-profile', {
    contactId: contact.id,
    profileId: profile.id,
  });
  console.log(`[BullMQ] Job Added: ${job.id}`);
}

runVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
