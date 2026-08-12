import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contact.findUnique({ where: { id: 'd53824a4-48b3-4ce2-af09-874b4990a821' } });
  console.log(JSON.stringify(c?.rawText, null, 2));
  console.log("----");
  console.log(JSON.stringify(c?.professionalProfile, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
