import { AppError } from '../../utils/AppError';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { parseContactString } from '../../utils/vcardParser';

const execFilePromise = promisify(execFile);

export class QrService {
  public async processQrImage(file: Express.Multer.File) {
    if (!file) {
      throw new AppError('No QR image file provided', 400);
    }

    try {
      const scriptPath = path.resolve(__dirname, '../../scripts/ocr_processor.py');
      const { stdout } = await execFilePromise('python', [scriptPath, file.path]);
      
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) {
        throw new AppError('QR image processing failed: invalid script output', 500);
      }
      
      const result = JSON.parse(stdout.substring(jsonStart));
      if (!result.success) {
        throw new AppError(result.message || 'QR processing script failed', 500);
      }

      if (!result.qr_present || !result.qr_data || result.qr_data.length === 0) {
        throw new AppError('No QR code detected in the uploaded image', 400);
      }

      const decodedText = result.qr_data[0];
      const parsedFields = parseContactString(decodedText);

      return {
        decodedText,
        parsedFields,
        metadata: {
          format: 'QR_CODE',
          confidence: 1.0,
          mimeType: file.mimetype,
          originalName: file.originalname,
        },
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`QR decoding failed: ${err.message}`, 500);
    }
  }
}
