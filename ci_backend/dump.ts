import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const contact = await prisma.contact.findFirst({
    where: { name: 'Kanishka Ramakrishnan' },
    include: { professionalProfile: true }
  });

  if (!contact) {
    console.log('Contact not found');
    return;
  }

  const profile = contact.professionalProfile;
  if (!profile) {
    console.log('No professional profile');
    return;
  }

  console.log('Provider Responses:');
  console.log(JSON.stringify(profile.providerResponses, null, 2));
}

run().finally(() => prisma.$disconnect());
