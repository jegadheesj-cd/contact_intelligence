import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function reset() {
  await prisma.professionalProfile.deleteMany({ where: { contactId: 'd53824a4-48b3-4ce2-af09-874b4990a821' } });
  console.log('Reset complete');
}
reset().finally(() => prisma.$disconnect());
