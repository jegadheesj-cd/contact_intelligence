import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const contacts = await prisma.contact.findMany({
    include: { professionalProfile: true }
  });

  console.log(`Found ${contacts.length} contacts.`);
  
  for (const c of contacts) {
    const hasCompanyInContact = !!c.company;
    const hasLinkedin = c.professionalProfile?.providerResponses?.some((r: any) => r.sourceName === 'LinkedIn URL Discovery');
    const linkedinProfile = c.professionalProfile?.providerResponses?.find((r: any) => r.sourceName === 'LinkedIn URL Discovery')?.data;
    const hasCompanyInLinkedin = !!linkedinProfile?.company;
    const hasCompanyWebsite = c.professionalProfile?.providerResponses?.some((r: any) => r.sourceName === 'Company Website');
    
    console.log(`Contact: ${c.name}`);
    console.log(`- c.company (DB): ${hasCompanyInContact ? c.company : 'NULL'}`);
    console.log(`- LinkedIn Discovered: ${hasLinkedin ? 'YES' : 'NO'}`);
    console.log(`- Company from LinkedIn: ${hasCompanyInLinkedin ? linkedinProfile.company : 'NULL'}`);
    console.log(`- Company Website Discovered: ${hasCompanyWebsite ? 'YES' : 'NO'}`);
    console.log('-----------------------------------');
  }
}

run().finally(() => prisma.$disconnect());
