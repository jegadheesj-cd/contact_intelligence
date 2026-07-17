import { parseContactString } from '../utils/vcardParser';

describe('QR & vCard Contact String Parsers', () => {
  test('vCard: Should parse complete vCard structures correctly', () => {
    const rawVCard = `BEGIN:VCARD
VERSION:3.0
FN:KIM LOU WAN
ORG:Creative Developers;Tech Division
TITLE:Managing Director
EMAIL:info@creativedevelopers.com
TEL:+1-555-123-4567
URL:https://creativedevelopers.com
ADR:;;132 9th Street;Lakeview Lane;NY;87903;USA
END:VCARD`;

    const parsed = parseContactString(rawVCard);

    expect(parsed.name).toBe('KIM LOU WAN');
    expect(parsed.company).toBe('Creative Developers');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.email).toBe('info@creativedevelopers.com');
    expect(parsed.phone).toBe('+1-555-123-4567');
    expect(parsed.website).toBe('https://creativedevelopers.com');
    expect(parsed.address).toBe('132 9th Street, Lakeview Lane, NY, 87903, USA');
  });

  test('MeCard: Should parse MECARD string tags correctly', () => {
    const rawMeCard = 'MECARD:N:Jambulingam,Jegadhees;ORG:Google Deepmind;TEL:+919999988888;EMAIL:jegadhees@example.com;URL:https://deepmind.google;ADR:London, UK;TIL:Senior Research Engineer;;';

    const parsed = parseContactString(rawMeCard);

    expect(parsed.name).toBe('Jegadhees Jambulingam');
    expect(parsed.company).toBe('Google Deepmind');
    expect(parsed.phone).toBe('+919999988888');
    expect(parsed.email).toBe('jegadhees@example.com');
    expect(parsed.website).toBe('https://deepmind.google');
    expect(parsed.address).toBe('London,  UK');
    expect(parsed.designation).toBe('Senior Research Engineer');
  });

  test('MATMSG: Should parse MATMSG email templates', () => {
    const rawMatMsg = 'MATMSG:TO:test@enterprise.com;SUB:Hello;BODY:How are you?;;';
    const parsed = parseContactString(rawMatMsg);
    expect(parsed.email).toBe('test@enterprise.com');
  });

  test('WhatsApp: Should parse WhatsApp shortlinks into phone numbers', () => {
    const waLink = 'https://wa.me/919999988888';
    const parsed = parseContactString(waLink);
    expect(parsed.phone).toBe('919999988888');
    expect(parsed.website).toBe('https://wa.me/919999988888');
  });

  test('WhatsApp: Should handle generic api.whatsapp.com queries', () => {
    const waLink2 = 'https://api.whatsapp.com/send?phone=15551234567';
    const parsed = parseContactString(waLink2);
    expect(parsed.phone).toBe('15551234567');
  });

  test('Plain Email: Should parse plain email addresses', () => {
    const emailStr = 'contact@enterprise.com';
    const parsed = parseContactString(emailStr);
    expect(parsed.email).toBe('contact@enterprise.com');
  });

  test('Plain URL: Should parse plain URLs and set website', () => {
    const urlStr = 'https://enterprise.com';
    const parsed = parseContactString(urlStr);
    expect(parsed.website).toBe('https://enterprise.com');
  });

  test('LinkedIn URL: Should parse LinkedIn url and capture both website and linkedin_url', () => {
    const linkedin = 'https://linkedin.com/in/jegadhees';
    const parsed = parseContactString(linkedin);
    expect(parsed.linkedin_url).toBe(linkedin);
    expect(parsed.website).toBe(linkedin);
  });

  test('Plain Name fallback: Should return text as name if format matches nothing else', () => {
    const nameStr = 'Jegadhees Jambulingam';
    const parsed = parseContactString(nameStr);
    expect(parsed.name).toBe('Jegadhees Jambulingam');
  });
});
