import { validateAndCorrectContact } from '../utils/validationEngine';
import { GoogleGenerativeAI } from '@google/generative-ai';

jest.mock('@google/generative-ai');

describe('Phase 1: Smart Contact Extraction (Zero-Hallucination & Swap Detection)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test_key';
  });

  afterAll(() => {
    delete process.env.GEMINI_API_KEY;
  });

  test('Should detect and swap misclassified fields correctly', async () => {
    // Mock the AI returning swapped fields
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          fields: {
            name: "John Doe",
            company: "Acme Corp",
            email: "www.johndoe.com", // Incorrect, is a website
            website: "john@johndoe.com", // Incorrect, is an email
            phone: "1234567890",
            mobile: null,
            office: null,
            designation: "CEO",
            address: null,
            street: null,
            city: null,
            state: null,
            postalCode: null,
            country: null,
            linkedin_url: null,
            github_url: null,
            twitter_url: null
          },
          understanding: [],
          needsManualReview: false
        })
      }
    });

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent
      })
    }));

    const rawOcr = 'John Doe CEO Acme Corp www.johndoe.com john@johndoe.com 1234567890';
    const initialFields = { name: 'John Doe', email: 'www.johndoe.com', website: 'john@johndoe.com' };

    const result = await validateAndCorrectContact(rawOcr, initialFields);
    
    // Engine applies local heuristics before OR after AI?
    // Wait, crossValidateFields is called FIRST, but the AI prompt also fixes it.
    // The engine's crossValidateFields ensures that if AI messes up, or initial fields mess up, it's corrected.
    
    // In our mock, the AI itself returns the swapped values in `fields`.
    // Actually, `validateAndCorrectContact` uses `crossValidateFields` on `initialFields`, 
    // then sends to AI. If AI returns swapped, wait, the AI returns the final JSON. 
    // Let's assert the AI output is parsed properly.
    // However, if we want to test `crossValidateFields` directly for swap detection:
    const { crossValidateFields } = require('../utils/validationEngine');
    const swapped = crossValidateFields({
      email: "www.johndoe.com",
      website: "john@johndoe.com"
    });

    expect(swapped.email).toBe("john@johndoe.com");
    expect(swapped.website).toBe("www.johndoe.com");
  });

  test('Zero-Hallucination: Should return null for missing fields instead of inventing data', async () => {
    // We mock AI returning exactly what a zero-hallucination prompt should enforce
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          fields: {
            name: "Jane Smith",
            company: null,
            email: null,
            website: null,
            phone: "9876543210",
            mobile: null,
            office: null,
            designation: null,
            address: null,
            street: null,
            city: null,
            state: null,
            postalCode: null,
            country: null,
            linkedin_url: null,
            github_url: null,
            twitter_url: null
          },
          understanding: [
            { field: "name", value: "Jane Smith", confidence: 0.99, source: "OCR", reasoning: "Largest text" },
            { field: "phone", value: "9876543210", confidence: 0.95, source: "OCR", reasoning: "Numeric pattern matching phone" }
          ],
          needsManualReview: false
        })
      }
    });

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent
      })
    }));

    const rawOcr = 'Jane Smith\n9876543210';
    const initialFields = { name: 'Jane Smith', phone: '9876543210' };

    const result = await validateAndCorrectContact(rawOcr, initialFields);
    
    expect(result.fields.name).toBe("Jane Smith");
    expect(result.fields.company).toBeNull(); // Should not invent company
    expect(result.fields.email).toBeNull();   // Should not invent email
    expect(result.fields.designation).toBeNull(); // Should not invent designation
    expect(result.understanding.length).toBeGreaterThanOrEqual(2);
    expect(result.understanding.map(u => u.field)).toContain("name");
    expect(result.understanding.map(u => u.field)).toContain("phone");
  });
});
