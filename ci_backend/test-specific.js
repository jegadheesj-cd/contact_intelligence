const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getContact() {
  const contact = await prisma.contact.findUnique({
    where: { id: '7907e4fe-71c2-4aaf-b478-d3d52e745626' },
    include: { professionalProfile: true }
  });
  console.log('Contact Name:', contact?.name);
  console.log('Enrichment Status:', contact?.professionalProfile?.enrichmentStatus);
  console.log('Experience:', JSON.stringify(contact?.professionalProfile?.mergedProfile?.experience, null, 2));
  console.log('Education:', JSON.stringify(contact?.professionalProfile?.mergedProfile?.education, null, 2));
}

getContact().finally(() => prisma.$disconnect());
