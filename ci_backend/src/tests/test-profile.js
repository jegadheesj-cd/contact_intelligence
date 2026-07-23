const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const profile = await prisma.professionalProfile.findFirst({
    orderBy: { updatedAt: 'desc' }
  });
  console.log(JSON.stringify(profile.providerResponses, null, 2));
}
main().finally(() => prisma.$disconnect());
