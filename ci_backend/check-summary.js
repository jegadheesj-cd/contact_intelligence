const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSummary() {
  const contact = await prisma.contact.findFirst({
    where: { name: { contains: 'Saranya', mode: 'insensitive' } },
    include: { professionalProfile: true }
  });
  
  const rawProfile = contact?.professionalProfile?.mergedProfile;
  
  console.log('=== SUMMARY VALUE ===');
  console.log(rawProfile?.summary?.value?.substring(0, 2000));
  
  console.log('\n=== COMPANY BIO ===');
  console.log(rawProfile?.companyBio?.value?.substring(0, 500));
  
  // Also check providerResponses for any summary/description text
  const responses = contact?.professionalProfile?.providerResponses || [];
  console.log('\n=== PROVIDER RESPONSES summary/description fields ===');
  for (const resp of responses) {
    const d = resp.data;
    console.log(`\nSource: ${resp.sourceName} (confidence: ${resp.confidence})`);
    if (d.summary) console.log(`  summary: ${d.summary.substring(0, 300)}`);
    if (d.headline) console.log(`  headline: ${d.headline}`);
    if (d.experience && d.experience.length > 0) console.log(`  experience: ${JSON.stringify(d.experience).substring(0, 300)}`);
    if (d.education && d.education.length > 0) console.log(`  education: ${JSON.stringify(d.education).substring(0, 300)}`);
  }

  await prisma.$disconnect();
}

checkSummary();
