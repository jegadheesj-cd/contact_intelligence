const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFrontendApi() {
  try {
    const contact = await prisma.contact.findFirst({
      where: { name: { contains: 'Saranya', mode: 'insensitive' } },
      include: { professionalProfile: true }
    });
    
    const rawProfile = contact?.professionalProfile?.mergedProfile;
    const flatProfile = {};
    if (rawProfile) {
      for (const [key, val] of Object.entries(rawProfile)) {
        if (val && typeof val === 'object' && 'value' in val) {
          flatProfile[key] = val.value;
        } else {
          flatProfile[key] = val;
        }
      }
    }
    
    console.log('--- flatProfile.experience ---');
    console.log(JSON.stringify(flatProfile.experience, null, 2));
    
    console.log('\n--- flatProfile.education ---');
    console.log(JSON.stringify(flatProfile.education, null, 2));

    await prisma.$disconnect();
  } catch (err) {
    console.error(err);
  }
}

testFrontendApi();
