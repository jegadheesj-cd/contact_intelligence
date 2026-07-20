import {
  cleanAndValidateField,
  crossValidateFields,
  validateAndCorrectContact,
} from '../utils/validationEngine';

describe('Validation & Correction Engine Heuristic Rules', () => {
  test('Phone validation: Should clean valid phone numbers and reject short/long ones', () => {
    // Valid phone numbers
    const phone1 = cleanAndValidateField('phone', '+1 (555) 123-4567');
    expect(phone1.isValid).toBe(true);
    expect(phone1.cleaned).toBe('+15551234567');

    const phone2 = cleanAndValidateField('phone', '022-4455-8899');
    expect(phone2.isValid).toBe(true);
    expect(phone2.cleaned).toBe('02244558899');

    // Invalid short/long numbers (pincodes, etc.)
    const pincode = cleanAndValidateField('phone', '641028');
    expect(pincode.isValid).toBe(false);

    const tooLong = cleanAndValidateField('phone', '1234567890123456789');
    expect(tooLong.isValid).toBe(false);
  });

  test('Email validation: Validate correct emails and reject invalid ones', () => {
    const valid = cleanAndValidateField('email', 'info@creativedev.com');
    expect(valid.isValid).toBe(true);
    expect(valid.cleaned).toBe('info@creativedev.com');

    const invalid = cleanAndValidateField('email', 'creativedev.com');
    expect(invalid.isValid).toBe(false);
  });

  test('Website validation: Validate URLs and reject emails', () => {
    const validUrl1 = cleanAndValidateField('website', 'www.company.com');
    expect(validUrl1.isValid).toBe(true);

    const validUrl2 = cleanAndValidateField('website', 'https://company.io/about');
    expect(validUrl2.isValid).toBe(true);

    const emailInWeb = cleanAndValidateField('website', 'info@company.com');
    expect(emailInWeb.isValid).toBe(false);
  });

  test('Cross validation: Swap website and email if misclassified', () => {
    const misclassified = {
      email: 'company.com',
      website: 'info@company.com',
      phone: '641028',
    };

    const corrected = crossValidateFields(misclassified);

    expect(corrected.email).toBe('info@company.com');
    expect(corrected.website).toBe('company.com');
    expect(corrected.phone).toBeNull();
    expect(corrected.postalCode).toBe('641028');
  });

  test('Address splitting: Heuristically parse address lines into components', () => {
    const addressData = {
      address: '132 9th Street, Lakeview Lane, NY, 87903, USA',
    };

    const corrected = crossValidateFields(addressData);

    expect(corrected.street).toBe('132 9th Street, Lakeview Lane');
    expect(corrected.city).toBe('NY');
    expect(corrected.postalCode).toBe('87903');
  });

  test('validateAndCorrectContact fallback: Should return local heuristic results when API is offline', async () => {
    // Temporarily remove API key to force local fallback
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const rawOcr = 'John Doe\nSoftware Engineer\ncompany.com\n641028\ninfo@company.com';
    const initial = {
      name: 'John Doe',
      designation: 'Software Engineer',
      email: 'company.com',
      website: 'info@company.com',
      phone: '641028',
    };

    const result = await validateAndCorrectContact(rawOcr, initial);

    expect(result.fields.name).toBe('John Doe');
    expect(result.fields.designation).toBe('Software Engineer');
    expect(result.fields.email).toBe('info@company.com');
    expect(result.fields.website).toBe('company.com');
    expect(result.fields.phone).toBeNull();
    expect(result.fields.postalCode).toBe('641028');
    expect(result.understanding.length).toBeGreaterThan(0);

    // Restore key
    process.env.GEMINI_API_KEY = originalKey;
  });
});
