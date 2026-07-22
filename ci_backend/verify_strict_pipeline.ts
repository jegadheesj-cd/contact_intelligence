import { ProfileEnrichmentService } from './src/modules/profile-enrichment/enrichment.service';
import { AiSummaryService } from './src/modules/ai-summary/ai-summary.service';
import prisma from './src/config/db';

async function main() {
  const enrichmentService = new ProfileEnrichmentService();
  const aiSummaryService = new AiSummaryService();

  console.log("=== Strict Enrichment Pipeline Test ===");

  // 1. Find a test user and contact
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found.");
    return;
  }

  let contact = await prisma.contact.findFirst({ where: { userId: user.id } });
  if (!contact) {
    console.log("No contact found, creating one...");
    contact = await prisma.contact.create({
      data: {
        userId: user.id,
        name: "Bill Gates",
        company: "Microsoft",
        designation: "Founder",
        source: "MANUAL",
        decisionMakerScore: 0,
        skills: [],
        interests: []
      }
    });
  }

  console.log(`Testing with Contact: ${contact.name} at ${contact.company}`);

  try {
    // 2. Discover
    console.log("\n[STATE: FETCHING_PROFILE]");
    const discovery = await enrichmentService.discover(
      contact.name, contact.email || null, contact.company || null, contact.designation || null, contact.website || null
    );
    
    if (!discovery) {
      console.log("Discovery failed to find a profile.");
      return;
    }
    console.log(`Discovered: ${discovery.candidate.fullName} (Score: ${discovery.matchScore}) via ${discovery.source}`);

    // 3. Verify
    console.log("\n[STATE: VERIFYING]");
    const verification = enrichmentService.verify(
      { name: contact.name, company: contact.company, designation: contact.designation, location: contact.address },
      { fullName: discovery.candidate.fullName, company: discovery.candidate.company || '', designation: discovery.candidate.designation || '', location: '' }
    );
    console.log(`Verification: ${verification.isVerified ? 'PASSED' : 'FAILED'} (Confidence: ${verification.confidence})`);
    
    if (!verification.isVerified) {
      console.log("Verification failed, aborting pipeline.");
      return;
    }

    // 4. Fetch Deep Details
    console.log("\n[STATE: FETCHING_DEEP_DETAILS]");
    const details = await enrichmentService.fetchDetails(discovery.candidate.salesNavigatorId);
    console.log(`Fetched Details: ${details.headline}`);

    // 5. Update DB (Mock)
    let linkedInProfile = await prisma.linkedInProfile.findFirst({ where: { contactId: contact.id } });
    if (!linkedInProfile) {
      linkedInProfile = await prisma.linkedInProfile.create({ data: { contactId: contact.id } });
    }
    
    await prisma.linkedInProfile.update({
      where: { id: linkedInProfile.id },
      data: {
        verificationStatus: `Verified via ${discovery.source}`,
        verificationConfidence: verification.confidence,
        profileData: details,
        enrichmentStatus: 'COMPLETED'
      }
    });

    // 6. Generate AI Summary
    console.log("\n[STATE: GENERATING_SUMMARY]");
    const summary = await aiSummaryService.generateSummary(user.id, contact.id);
    console.log("Summary Generated:");
    console.log(JSON.parse(summary.summaryText || '{}'));

    console.log("\n=== Pipeline Test Complete ===");
  } catch (error: any) {
    console.error("Pipeline failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
