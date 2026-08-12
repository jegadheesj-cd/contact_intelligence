const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectRawData() {
  const contact = await prisma.contact.findFirst({
    where: { name: { contains: 'Saranya', mode: 'insensitive' } },
    include: { professionalProfile: true }
  });

  const responses = contact?.professionalProfile?.providerResponses || [];
  
  for (const resp of responses) {
    console.log(`\n\n--- Source: ${resp.sourceName} | Confidence: ${resp.confidence} ---`);
    console.log('--- Raw Data Keys ---');
    console.log(Object.keys(resp.data));
    
    // Look for experience-like arrays
    console.log('\n--- Searching for Array data ---');
    for (const [key, value] of Object.entries(resp.data)) {
      if (Array.isArray(value) && value.length > 0) {
        console.log(`Array field: ${key} (length: ${value.length})`);
        console.log(`First item:`, JSON.stringify(value[0]).substring(0, 300));
      }
    }
  }
}

inspectRawData().finally(() => prisma.$disconnect());
