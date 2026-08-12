// Temporary debug script to inspect mergedProfile data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugProfile() {
  try {
    // Find contacts that have a professionalProfile
    const contacts = await prisma.contact.findMany({
      where: {
        professionalProfile: {
          enrichmentStatus: 'COMPLETED'
        }
      },
      include: {
        professionalProfile: true,
      },
      take: 3,
    });

    console.log(`Found ${contacts.length} completed contacts`);

    for (const contact of contacts) {
      console.log('\n========================================');
      console.log(`Contact: ${contact.name} (${contact.id})`);
      console.log(`Company: ${contact.company}`);
      console.log(`Enrichment Status: ${contact.professionalProfile?.enrichmentStatus}`);
      
      const mp = contact.professionalProfile?.mergedProfile;
      if (mp) {
        console.log('\n--- mergedProfile keys ---');
        console.log(Object.keys(mp));
        
        // Check experience
        const exp = mp.experience;
        console.log('\n--- experience field ---');
        console.log('Type:', typeof exp);
        if (exp && typeof exp === 'object') {
          if ('value' in exp) {
            console.log('Has .value:', Array.isArray(exp.value));
            console.log('Value length:', exp.value?.length);
            console.log('Source:', exp.source);
            if (exp.value?.length > 0) {
              console.log('First experience entry:', JSON.stringify(exp.value[0], null, 2));
            }
          } else {
            console.log('Raw experience:', JSON.stringify(exp).substring(0, 500));
          }
        }
        
        // Check education
        const edu = mp.education;
        console.log('\n--- education field ---');
        console.log('Type:', typeof edu);
        if (edu && typeof edu === 'object') {
          if ('value' in edu) {
            console.log('Has .value:', Array.isArray(edu.value));
            console.log('Value length:', edu.value?.length);
            console.log('Source:', edu.source);
            if (edu.value?.length > 0) {
              console.log('First education entry:', JSON.stringify(edu.value[0], null, 2));
            }
          } else {
            console.log('Raw education:', JSON.stringify(edu).substring(0, 500));
          }
        }

        // Check organizations and volunteering
        console.log('\n--- organizations field ---');
        console.log(mp.organizations ? JSON.stringify(mp.organizations).substring(0, 500) : 'NOT PRESENT');
        console.log('\n--- volunteerExperience field ---');
        console.log(mp.volunteerExperience ? JSON.stringify(mp.volunteerExperience).substring(0, 500) : 'NOT PRESENT');
        
        // Check providerResponses
        const pr = contact.professionalProfile?.providerResponses;
        if (pr && Array.isArray(pr)) {
          console.log('\n--- providerResponses ---');
          console.log(`Count: ${pr.length}`);
          for (const resp of pr) {
            console.log(`  Source: ${resp.sourceName}, Confidence: ${resp.confidence}`);
            const data = resp.data;
            if (data) {
              console.log(`    experience items: ${data.experience?.length || 0}`);
              console.log(`    education items: ${data.education?.length || 0}`);
              console.log(`    organizations items: ${data.organizations?.length || 0}`);
              console.log(`    volunteerExperience items: ${data.volunteerExperience?.length || 0}`);
              if (data.experience?.length > 0) {
                console.log(`    First exp: ${JSON.stringify(data.experience[0]).substring(0, 300)}`);
              }
              if (data.education?.length > 0) {
                console.log(`    First edu: ${JSON.stringify(data.education[0]).substring(0, 300)}`);
              }
              // Check summary/biography for experience text
              if (data.summary) {
                const summaryText = typeof data.summary === 'string' ? data.summary : '';
                if (summaryText.toLowerCase().includes('experience')) {
                  console.log(`    Summary contains 'experience' text (length: ${summaryText.length})`);
                }
              }
            }
          }
        }
      } else {
        console.log('NO mergedProfile');
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

debugProfile();
