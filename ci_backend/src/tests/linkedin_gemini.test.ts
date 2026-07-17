jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                fullName: 'Jane Doe',
                company: 'Gemini Corp',
                designation: 'Staff Architect',
                skills: ['Go', 'Cloud'],
                experience: [],
                education: [],
                confidenceScore: 0.95
              })
            }
          })
        };
      }
    }
  };
});

import linkedinService, { LinkedInService } from '../modules/linkedin/linkedin.service';
import { RapidApiLinkedInProvider, PublicInfoLinkedInProvider } from '../modules/linkedin/linkedin.provider';

describe('LinkedIn Integration Provider & Gemini Grounding Service', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('RapidAPI: Successful query maps values correctly', async () => {
    const mockSuccessResponse = {
      data: [
        {
          linkedin_url: 'https://linkedin.com/in/jane-doe',
          full_name: 'Jane Doe',
          company: 'Rapid Corp',
          title: 'Principal Designer',
          profile_image: 'https://pic.url/jane',
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockSuccessResponse),
    });

    const provider = new RapidApiLinkedInProvider();
    (provider as any).getApiKey = () => 'valid-rapid-key';

    const results = await provider.search('Jane Doe', 'Rapid Corp');

    expect(results.length).toBe(1);
    expect(results[0].fullName).toBe('Jane Doe');
    expect(results[0].company).toBe('Rapid Corp');
    expect(results[0].designation).toBe('Principal Designer');
    expect(results[0].linkedInUrl).toBe('https://linkedin.com/in/jane-doe');
  });

  test('RapidAPI: Quota rate limit (429) triggers exception', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    const provider = new RapidApiLinkedInProvider();
    (provider as any).getApiKey = () => 'valid-rapid-key';

    await expect(provider.search('Jane Doe')).rejects.toThrow('RapidAPI search failed with status: 429');
  });

  test('LinkedIn Service Fallback Chain: RapidAPI failure activates Gemini search fallback', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));

    const provider = new RapidApiLinkedInProvider();
    (provider as any).getApiKey = () => 'valid-rapid-key';

    const service = new LinkedInService(provider);

    // Should not throw, but fall back to PublicInfoLinkedInProvider (Gemini)
    const results = await service.searchProfiles('Jane Doe', 'Rapid Corp');

    expect(results.length).toBe(1);
    expect(results[0].fullName).toBe('Jane Doe'); // From mocked Gemini provider return
  }, 15000);
});
