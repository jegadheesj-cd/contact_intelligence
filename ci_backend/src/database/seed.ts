import { PrismaClient, Role, ContactSource, JobStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Reset existing table records sequentially (order matters due to foreign keys)
  await prisma.auditLog.deleteMany({});
  await prisma.nFCData.deleteMany({});
  await prisma.faceRecognition.deleteMany({});
  await prisma.aISummary.deleteMany({});
  await prisma.professionalProfile.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.businessCard.deleteMany({});
  await prisma.uploadedFile.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleaned.');

  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const hashedUserPassword = await bcrypt.hash('user123', 10);

  // 1. Create Core Users
  const admin = await prisma.user.create({
    data: {
      fullName: 'System Administrator',
      email: 'admin@enterprise.com',
      password: hashedAdminPassword,
      organization: 'ContactIntel Platform',
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.create({
    data: {
      fullName: 'Jane Doe',
      email: 'user@enterprise.com',
      password: hashedUserPassword,
      organization: 'Innovate Tech',
      role: Role.USER,
    },
  });

  console.log(`Created user accounts: Admin (${admin.email}), Regular User (${user.email})`);

  // 2. Create seed contacts with relationships
  const tagInvestor = await prisma.tag.create({
    data: { name: 'Investor', userId: user.id },
  });
  const tagVIP = await prisma.tag.create({
    data: { name: 'VIP', userId: user.id },
  });

  const contact1 = await prisma.contact.create({
    data: {
      userId: user.id,
      name: 'Alice Johnson',
      company: 'Future Ventures',
      designation: 'Managing Partner',
      email: 'alice@futureventures.com',
      phone: '+1 (555) 019-2834',
      website: 'https://futureventures.com',
      address: '100 Sand Hill Road, Menlo Park, CA 94025',
      skills: ['Venture Capital', 'Corporate Development', 'Fintech Strategy'],
      industry: 'Investment Banking',
      experience: [
        { title: 'Managing Partner', company: 'Future Ventures', period: '2022 - Present' },
        { title: 'Investment Associate', company: 'TechFund Private', period: '2019 - 2022' },
      ],
      education: [
        { school: 'Harvard Business School', degree: 'MBA', year: '2019' },
      ],
      interests: ['Renewable Tech', 'Web3 Systems'],
      hobbies: ['Sailing', 'Equestrian'],
      decisionMakerScore: 87,
      source: ContactSource.MANUAL,
      tags: {
        connect: [
          { id: tagInvestor.id },
          { id: tagVIP.id },
        ],
      },
      notes: {
        create: {
          content: 'Discussed Series A pipeline opportunities over lunch. Eager to see deck.',
          userId: user.id,
        },
      },
      professionalProfile: {
        create: {
          verificationStatus: 'Pending',
          enrichmentStatus: 'PENDING',
        }
      },
      aiSummary: {
        create: {
          summaryText: 'Alice is a Senior Managing Partner at Future Ventures with an HBS MBA. Strong decision-maker profile (Score: 87) interested in early-stage fintech opportunities.',
          status: JobStatus.COMPLETED,
        },
      },
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      userId: user.id,
      name: 'Bob Miller',
      company: 'SaaSify Inc',
      designation: 'Lead Platform Architect',
      email: 'bob.miller@saasify.io',
      phone: '+1 (555) 014-9988',
      website: 'https://saasify.io',
      address: '700 Pike St, Seattle, WA 98101',
      skills: ['Kubernetes', 'Golang', 'PostgreSQL', 'Distributed Systems'],
      industry: 'Software & Technology',
      source: ContactSource.BUSINESS_CARD,
      tags: {
        create: {
          name: 'Technical',
          userId: user.id,
        },
      },
      notes: {
        create: {
          content: 'Met at AWS re:Invent 2026. Handed physical business card.',
          userId: user.id,
        },
      },
    },
  });

  console.log(`Successfully seeded contact files: ${contact1.name}, ${contact2.name}`);
  console.log('🌱 Database seed sequence complete.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
