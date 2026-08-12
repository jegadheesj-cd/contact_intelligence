const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFullSummary() {
  const contact = await prisma.contact.findFirst({
    where: { name: { contains: 'Saranya', mode: 'insensitive' } },
    include: { professionalProfile: true }
  });
  
  const responses = contact?.professionalProfile?.providerResponses || [];
  const linkedinResp = responses.find(r => r.sourceName === 'LinkedIn URL Discovery' && r.confidence >= 90);
  
  if (linkedinResp) {
    console.log('=== FULL SUMMARY TEXT ===');
    console.log(linkedinResp.data.summary);
  }

  await prisma.$disconnect();
}

checkFullSummary();
