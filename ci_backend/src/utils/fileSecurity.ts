import fs from 'fs';
import crypto from 'crypto';
import net from 'net';

/**
 * Calculates the SHA-256 hash of a file
 */
export const calculateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
};

/**
 * Communicates with ClamAV clamd daemon over TCP socket using the INSTREAM protocol.
 * Optional and fail-safe.
 */
export const scanWithClamAV = (filePath: string): Promise<{ safe: boolean; reason?: string }> => {
  return new Promise((resolve) => {
    const host = process.env.CLAMAV_HOST || 'localhost';
    const port = parseInt(process.env.CLAMAV_PORT || '3310', 10);
    
    const client = new net.Socket();
    client.setTimeout(5000); // 5 seconds scan timeout

    let responded = false;

    client.connect(port, host, () => {
      // Send INSTREAM command
      client.write('nINSTREAM\n');
      
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('data', (chunk: any) => {
        const sizeBuf = Buffer.alloc(4);
        sizeBuf.writeUInt32BE(chunk.length, 0);
        client.write(sizeBuf);
        client.write(chunk);
      });
      
      fileStream.on('end', () => {
        // Send termination chunk (0 size)
        const zeroBuf = Buffer.alloc(4);
        zeroBuf.writeUInt32BE(0, 0);
        client.write(zeroBuf);
      });

      fileStream.on('error', (err: any) => {
        client.destroy();
        if (!responded) {
          responded = true;
          // Fail gracefully (warn, but let file proceed)
          console.warn(`[ClamAV Scan] Warning: failed to read file during scan: ${err.message}`);
          resolve({ safe: true });
        }
      });
    });

    let responseData = '';
    client.on('data', (data) => {
      responseData += data.toString();
    });

    client.on('end', () => {
      if (!responded) {
        responded = true;
        const resultText = responseData.trim();
        // ClamAV responds with "stream: OK" or "stream: <VirusName> FOUND"
        const clean = resultText.toUpperCase().includes('OK') && !resultText.toUpperCase().includes('FOUND');
        if (clean) {
          resolve({ safe: true });
        } else {
          resolve({ 
            safe: false, 
            reason: `Malware scan flagged file as unsafe. Scan output: ${resultText}` 
          });
        }
      }
    });

    client.on('error', (err) => {
      client.destroy();
      if (!responded) {
        responded = true;
        // Make antivirus scanning optional: continue working if ClamAV is offline/missing
        console.warn(`[ClamAV Scan] Warning: ClamAV connection failed: ${err.message}. Skipping antivirus check.`);
        resolve({ safe: true });
      }
    });

    client.on('timeout', () => {
      client.destroy();
      if (!responded) {
        responded = true;
        console.warn('[ClamAV Scan] Warning: ClamAV request timed out. Skipping antivirus check.');
        resolve({ safe: true });
      }
    });
  });
};

/**
 * Validates magic numbers (file headers) to verify the actual file type,
 * checks for double extensions, and optionally runs ClamAV scan.
 */
export const scanFileForMalware = async (filePath: string, originalName: string, mimeType: string): Promise<{ safe: boolean; reason?: string }> => {
  // 1. Check for double extensions (e.g. card.png.exe, shell.php.jpg)
  const extCount = (originalName.match(/\./g) || []).length;
  if (extCount > 1) {
    const lowerName = originalName.toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.js', '.ts', '.vbs', '.scr', '.pif'];
    if (dangerousExtensions.some(ext => lowerName.includes(ext))) {
      return { safe: false, reason: 'Double extensions or potential executable scripts detected.' };
    }
  }

  // 2. Validate magic numbers (first few bytes of the file)
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toUpperCase();

    // Check common formats
    if (mimeType.includes('image/jpeg') || mimeType.includes('image/jpg')) {
      // JPEG starts with FF D8 FF
      if (!hex.startsWith('FFD8FF')) {
        return { safe: false, reason: 'Invalid JPEG file signature.' };
      }
    } else if (mimeType.includes('image/png')) {
      // PNG starts with 89 50 4E 47 0D 0A 1A 0A
      if (!hex.startsWith('89504E47')) {
        return { safe: false, reason: 'Invalid PNG file signature.' };
      }
    } else if (mimeType.includes('image/webp')) {
      // WEBP starts with RIFF (52 49 46 46)
      if (!hex.startsWith('52494646')) {
        return { safe: false, reason: 'Invalid WEBP file signature.' };
      }
    } else if (mimeType.includes('video/mp4')) {
      // MP4 starts with ftyp (typically bytes at index 4-7 are 66 74 79 70)
      if (hex.slice(8, 16) !== '66747970') {
        return { safe: false, reason: 'Invalid MP4 video file signature.' };
      }
    }
  } catch (err: any) {
    return { safe: false, reason: `File signature validation failed: ${err.message}` };
  }

  // 3. Optional ClamAV antivirus scanning
  if (process.env.CLAMAV_ENABLED === 'true') {
    const clamResult = await scanWithClamAV(filePath);
    if (!clamResult.safe) {
      return clamResult;
    }
  }

  return { safe: true };
};
