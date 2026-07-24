import { ProfileDiscoveryEngine } from './src/modules/profile-enrichment/services/ProfileDiscoveryEngine';

async function testDiscovery() {
  console.log("=== STARTING TRACE ===");
  const contact = {
    name: "Jegadhees J",
    company: "Cloud Destinations",
    designation: "Software Engineer Intern",
    email: "jegadhees@clouddestinations.com",
    website: "clouddestinations.com"
  };

  const engine = new ProfileDiscoveryEngine();
  try {
    const result = await engine.fullDiscovery(contact);
    console.log("=== DISCOVERY COMPLETED SUCCESS ===");
    console.log("Result Candidates:", result.candidates.length);
    console.log("Result Rejections:", result.rejectionReasons);
  } catch (err: any) {
    console.error("=== DISCOVERY CRASHED ===");
    console.error(err.name, err.message);
    if (err.stack) console.error(err.stack);
  }
}

testDiscovery().catch(console.error).finally(() => process.exit(0));
