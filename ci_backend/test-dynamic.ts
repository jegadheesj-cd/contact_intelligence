import { PrismaClient } from '@prisma/client';
import { ProfileEnrichmentService } from './src/modules/profile-enrichment/enrichment.service';

const prisma = new PrismaClient();

async function run() {
  // Create a fake contact with NO company
  const contact = await prisma.contact.create({
    data: {
      name: 'Jegadhees Jambulingam',
      email: 'jegadheesh@clouddestinations.com',
      userId: 'test-user',
    }
  });

  console.log('Created fake contact without company:', contact.id);

  const enrichmentService = new ProfileEnrichmentService();
  
  try {
    const pipelineResult = await enrichmentService.runDiscoveryPipeline(contact);
    console.log('Pipeline Output:');
    console.log(JSON.stringify(pipelineResult.providerResponses?.map((r: any) => ({
      source: r.sourceName,
      company: r.data.company,
      url: r.data.publicProfiles?.[0]?.url
    })), null, 2));
  } catch(e) {
    console.error('Error:', e);
  }

  // Cleanup
  await prisma.contact.delete({ where: { id: contact.id } });
}

run().finally(() => prisma.$disconnect());
