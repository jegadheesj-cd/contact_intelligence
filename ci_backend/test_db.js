const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const profile = await prisma.professionalProfile.findFirst({ where: { contactId: '98da4a96-83b1-44e8-8651-9c1287a49fd8' } });
  console.log('Status: ' + profile.enrichmentStatus);
  console.log('Verification: ' + profile.verificationStatus);
  console.log('Responses: ' + JSON.stringify(profile.providerResponses, null, 2));
}
run().finally(() => process.exit(0));
