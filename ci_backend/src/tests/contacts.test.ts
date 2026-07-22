import { ContactsService } from '../modules/contacts/contacts.service';
import prisma from '../config/db';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    contact: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe('Contacts Duplicate Analysis & Similarity Scorer', () => {
  let contactsService: ContactsService;

  beforeEach(() => {
    contactsService = new ContactsService();
    jest.clearAllMocks();
  });

  test('Similarity scorer should return 1.0 for exact matches', () => {
    // Indirect test of calculateSimilarity
    const similarity = (contactsService as any).calculateSimilarity('Jegadhees Jambulingam', 'Jegadhees Jambulingam');
    expect(similarity).toBe(1.0);
  });

  test('Similarity scorer should return a score proportional to editing distance', () => {
    const similarity1 = (contactsService as any).calculateSimilarity('John Doe', 'Jon Doe');
    const similarity2 = (contactsService as any).calculateSimilarity('John Doe', 'Jane Smith');
    expect(similarity1).toBeGreaterThan(0.7);
    expect(similarity2).toBeLessThan(0.3);
  });

  test('detectDuplicates should analyze contacts and assign scores based on email/phone/name matching', async () => {
    const mockContact = {
      id: 'contact-1',
      name: 'Jegadhees Jambulingam',
      email: 'jegadhees@example.com',
      phone: '+15551234567',
      company: 'Enterprise Inc',
      website: 'enterprise.io',
      skills: [],
    };

    const mockOthers = [
      {
        id: 'contact-2',
        name: 'Jegadhees J.',
        email: 'jegadhees@example.com', // exact email matches (+60 pts)
        phone: '+15559876543',
        company: 'Enterprise Inc', // similar company (+15 pts)
        website: '',
        skills: [],
      },
      {
        id: 'contact-3',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+15551234567', // exact phone matches (+50 pts)
        company: 'Different LLC',
        website: '',
        skills: [],
      }
    ];

    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
    (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockOthers);

    const duplicates = await contactsService.detectDuplicates('user-1', 'contact-1');

    expect(duplicates.length).toBe(2);
    expect(duplicates[0].duplicateScore).toBeGreaterThanOrEqual(75); // 65 (email) + company sim
    expect(duplicates[0].reasons).toContain('Exact email match');
    expect(duplicates[1].duplicateScore).toBe(55); // upgraded phone match score
    expect(duplicates[1].reasons).toContain('Exact phone match');
  });

  test('createContact should merge fields into existing contact if a duplicate is found', async () => {
    const mockContact = {
      id: 'contact-existing',
      name: 'Jegadhees Jambulingam',
      email: 'jegadhees@example.com',
      phone: '+15551234567',
      company: 'Enterprise Inc',
      website: 'enterprise.io',
      skills: ['TypeScript'],
      interests: [],
      hobbies: [],
      professionalProfile: {
        mergedProfile: {
          profileUrl: 'https://linkedin.com/in/jegadhees',
        }
      },
    };

    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([mockContact]);

    // Mock prisma.contact.update
    (prisma.contact.update as any) = jest.fn().mockResolvedValue({
      ...mockContact,
      skills: ['TypeScript', 'Go'],
      designation: 'Principal Engineer',
    });

    const inputData = {
      name: 'Jegadhees Jambulingam',
      email: 'jegadhees@example.com',
      company: 'Enterprise Inc',
      designation: 'Principal Engineer',
      skills: ['Go'],
    };

    const result = await contactsService.createContact('user-1', inputData);

    expect(prisma.contact.update).toHaveBeenCalled();
    expect(result.id).toBe('contact-existing');
  });
});
