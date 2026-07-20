import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.linkedInProfile.updateMany({
    where: {
      enrichmentStatus: { in: ['PENDING', 'PROCESSING'] }
    },
    data: {
      enrichmentStatus: 'FAILED'
    }
  });
  console.log('Reset stuck jobs to FAILED');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
