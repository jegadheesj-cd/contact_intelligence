require('dotenv').config();
const { PhantomBusterEnricher } = require('./src/modules/profile-enrichment/services/providers/PhantomBusterEnricher');

async function testPB() {
  const pb = new PhantomBusterEnricher();
  console.log('Is configured?', pb.isConfigured());
  
  // Use Saranya's URL
  const url = 'https://in.linkedin.com/in/saranya-muruganantham-695237142';
  console.log('Testing PhantomBuster for:', url);
  
  const result = await pb.enrichProfile(url);
  console.log('--- Result ---');
  if (result) {
    console.log('Experience count:', result.experience?.length);
    console.log('Education count:', result.education?.length);
    if (result.experience?.length > 0) {
      console.log('First experience:', result.experience[0]);
    }
  } else {
    console.log('Enrichment returned null');
  }
}

testPB().catch(console.error);
