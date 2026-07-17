import { parseAndNormalizeNfc } from '../modules/nfc/nfc.service';

describe('NFC Payload Normalizers', () => {
  test('NFC Case 1: Plain JSON String representation', () => {
    const rawJsonString = JSON.stringify({
      fullName: 'John Doe',
      company: 'Enterprise Co',
      jobTitle: 'Solutions Architect',
      emailAddress: 'john.doe@enterprise.com',
      mobile: '+1-555-555-5555',
    });

    const parsed = parseAndNormalizeNfc(rawJsonString);

    expect(parsed.name).toBe('John Doe');
    expect(parsed.company).toBe('Enterprise Co');
    expect(parsed.designation).toBe('Solutions Architect');
    expect(parsed.email).toBe('john.doe@enterprise.com');
    expect(parsed.phone).toBe('+1-555-555-5555');
  });

  test('NFC Case 2: NDEF records array (URI platform records)', () => {
    const ndefPayload = {
      records: [
        {
          type: 'U',
          tnf: 1,
          payload: Buffer.from([0x04, ...Buffer.from('linkedin.com/in/johnsmith')]), // Prefix code 0x04 = https://
        },
      ],
    };

    const parsed = parseAndNormalizeNfc(ndefPayload);
    expect(parsed.linkedin_url).toBe('https://linkedin.com/in/johnsmith');
    expect(parsed.website).toBe('https://linkedin.com/in/johnsmith');
  });

  test('NFC Case 2: NDEF records array (Text record payload)', () => {
    const ndefPayload = {
      records: [
        {
          type: 'T',
          tnf: 1,
          payload: Buffer.from([0x02, 0x65, 0x6e, ...Buffer.from('MECARD:N:Jane Smith;TEL:+15551234;;')]), // Lang code header 'en' (length 2)
        },
      ],
    };

    const parsed = parseAndNormalizeNfc(ndefPayload);
    expect(parsed.name).toBe('Jane Smith');
    expect(parsed.phone).toBe('+15551234');
  });

  test('NFC Case 3: Flat Custom JSON object mapping', () => {
    const rawPayload = {
      fn: 'Jane Smith',
      organization: 'Tech Pioneers',
      role: 'Staff Lead',
      email: 'jane@tech.io',
      tel: '+15550000',
      url: 'https://tech.io',
      location: 'SF, CA',
    };

    const parsed = parseAndNormalizeNfc(rawPayload);

    expect(parsed.name).toBe('Jane Smith');
    expect(parsed.company).toBe('Tech Pioneers');
    expect(parsed.designation).toBe('Staff Lead');
    expect(parsed.email).toBe('jane@tech.io');
    expect(parsed.phone).toBe('+15550000');
    expect(parsed.website).toBe('https://tech.io');
    expect(parsed.address).toBe('SF, CA');
  });

  test('NFC: Empty payload should return empty object', () => {
    const parsed = parseAndNormalizeNfc(null);
    expect(parsed).toEqual({});
  });
});
