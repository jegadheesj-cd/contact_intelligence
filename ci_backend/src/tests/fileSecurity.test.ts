import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { scanFileForMalware, calculateFileHash } from '../utils/fileSecurity';

describe('File Security & Hashing Utilities', () => {
  const tempTestFile = path.resolve(__dirname, '../../scratch/temp_security_test_file.txt');
  const tempTestDir = path.dirname(tempTestFile);

  beforeAll(() => {
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempTestFile)) {
      fs.unlinkSync(tempTestFile);
    }
  });

  test('calculateFileHash should generate a correct SHA256 checksum', async () => {
    const content = 'hello contact intelligence platform';
    fs.writeFileSync(tempTestFile, content);
    const hash = await calculateFileHash(tempTestFile);
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
    expect(hash).toBe(expectedHash);
  });

  test('scanFileForMalware should flag dangerous double extensions', async () => {
    fs.writeFileSync(tempTestFile, 'dummy data');
    const result = await scanFileForMalware(tempTestFile, 'invoice.pdf.exe', 'application/octet-stream');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Double extensions');
  });

  test('scanFileForMalware should flag JPEG mimetype with invalid magic header', async () => {
    fs.writeFileSync(tempTestFile, 'not-a-jpeg-header-obviously');
    const result = await scanFileForMalware(tempTestFile, 'image.jpg', 'image/jpeg');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Invalid JPEG file signature');
  });

  test('scanFileForMalware should approve JPEG with valid magic header', async () => {
    // JPEG header: FF D8 FF E0
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0x00, 0x00]);
    fs.writeFileSync(tempTestFile, buffer);
    const result = await scanFileForMalware(tempTestFile, 'photo.jpg', 'image/jpeg');
    expect(result.safe).toBe(true);
  });
});
