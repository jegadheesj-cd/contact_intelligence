const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const c = await prisma.professionalProfile.findUnique({ where: { contactId: 'd53824a4-48b3-4ce2-af09-874b4990a821' } });
  console.log(JSON.stringify(c, null, 2));
}
check().finally(() => prisma.$disconnect());
