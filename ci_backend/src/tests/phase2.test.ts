import { ProfileEnrichmentService } from '../modules/profile-enrichment/enrichment.service';
import linkedinService from '../modules/linkedin/linkedin.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ILinkedInSearchResult } from '../modules/linkedin/linkedin.provider';

jest.mock('../modules/linkedin/linkedin.service');
jest.mock('@google/generative-ai');

describe('Phase 2: Business Intelligence Priority Chain Fallback', () => {
  let enrichmentService: ProfileEnrichmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test_key';
    enrichmentService = new ProfileEnrichmentService();
  });

  afterAll(() => {
    delete process.env.GEMINI_API_KEY;
  });

  test('Should use LinkedIn as primary and skip AI fallback if LinkedIn returns highly confident full profile', async () => {
    // Mock LinkedIn success
    const searchMock = jest.fn().mockResolvedValue([{ fullName: 'Alice', salesNavigatorId: '123' }] as ILinkedInSearchResult[]);
    const detailsMock = jest.fn().mockResolvedValue({
      profileUrl: 'linkedin.com/in/alice',
      designation: 'CTO',
      company: 'TechCorp',
      skills: ['React', 'Node'],
      experience: [],
      education: [],
      headline: 'CTO at TechCorp'
    });
    
    (linkedinService.searchProfiles as jest.Mock) = searchMock;
    (linkedinService.getProfileDetails as jest.Mock) = detailsMock;

    // AI is still called for synthesis, but let's mock it to just return what it got
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          company: 'TechCorp',
          designation: 'CTO',
          skills: ['React', 'Node'],
          verificationStatus: 'Verified via LinkedIn',
          confidenceScore: 0.95
        })
      }
    });

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent
      })
    }));

    const result = await enrichmentService.instantEnrich('Alice', 'alice@techcorp.com', 'TechCorp');
    
    expect(linkedinService.searchProfiles).toHaveBeenCalledWith('Alice', 'TechCorp');
    expect(linkedinService.getProfileDetails).toHaveBeenCalledWith('123');
    
    // AI synthesis is called WITH the LinkedIn context
    expect(mockGenerateContent).toHaveBeenCalled();
    const promptArg = mockGenerateContent.mock.calls[0][0];
    expect(promptArg).toContain('Existing LinkedIn Context');
    expect(promptArg).toContain('CTO at TechCorp');
    
    expect(result.verificationStatus).toBe('Verified via LinkedIn');
  });

  test('Should gracefully fallback to AI Google Search if LinkedIn fails', async () => {
    // Mock LinkedIn failure
    (linkedinService.searchProfiles as jest.Mock).mockRejectedValue(new Error('API quota exceeded'));

    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          company: 'StartupX',
          designation: 'Founder',
          skills: ['Strategy'],
          verificationStatus: 'Verified via General Search',
          confidenceScore: 0.70
        })
      }
    });

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent
      })
    }));

    const result = await enrichmentService.instantEnrich('Bob', 'bob@startupx.com', 'StartupX');

    // Should log fallback and proceed
    expect(mockGenerateContent).toHaveBeenCalled();
    const promptArg = mockGenerateContent.mock.calls[0][0];
    expect(promptArg).toContain('Existing LinkedIn Context:\nNone');

    expect(result.verificationStatus).toBe('Verified via General Search');
    expect(result.confidenceScore).toBe(0.70);
  });
});
