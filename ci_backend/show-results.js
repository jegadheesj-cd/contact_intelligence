const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showExtractedData() {
  const contact = await prisma.contact.findFirst({
    where: { name: { contains: 'Saranya', mode: 'insensitive' } },
    include: { professionalProfile: true }
  });

  if (!contact?.professionalProfile?.mergedProfile) {
    console.log('Contact not found');
    return;
  }

  const m = contact.professionalProfile.mergedProfile;
  
  console.log('\n✅ SARANYA MURUGANANTHAM - EXTRACTED CAREER DATA\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📌 EXPERIENCE:');
  if (m.experience?.value?.length > 0) {
    m.experience.value.forEach((exp, i) => {
      console.log(`  [${i+1}] ${exp.title} @ ${exp.company}`);
      if (exp.startDate) console.log(`       📅 ${exp.startDate} to ${exp.endDate || 'Present'}`);
    });
    console.log(`  Source: ${m.experience.source} | Confidence: ${m.experience.confidence}%\n`);
  } else {
    console.log('  ❌ No experience found\n');
  }

  console.log('🎓 EDUCATION:');
  if (m.education?.value?.length > 0) {
    m.education.value.slice(0, 3).forEach((edu, i) => {
      console.log(`  [${i+1}] ${edu.degree} in ${edu.fieldOfStudy || 'N/A'}`);
      console.log(`       🏫 ${edu.school}`);
    });
    console.log(`  Total: ${m.education.value.length} entries`);
    console.log(`  Source: ${m.education.source}\n`);
  } else {
    console.log('  ❌ No education found\n');
  }

  console.log('🏢 ORGANIZATIONS:');
  if (m.organizations?.value?.length > 0) {
    m.organizations.value.slice(0, 3).forEach((org, i) => {
      console.log(`  [${i+1}] ${org.name} - ${org.role}`);
    });
  } else {
    console.log('  ❌ No organizations found');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ DATA IS EXTRACTED AND READY FOR DISPLAY\n');
  console.log('Now visit: http://localhost:5173/');
  console.log('And navigate to Saranya Muruganantham profile');
  console.log('Check the "Experience & Education" tab!\n');
}

showExtractedData()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
