import { AppError } from '../../utils/AppError';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { parseContactString } from '../../utils/vcardParser';
import { runGeminiOcrClassifier } from '../../utils/validationEngine';

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
      const qrFields = parseContactString(decodedText);
      const ocrFields = result.structured || {};

      // Merge logic: QR data (vCard/URL) takes priority, missing fields fall back to OCR printed text
      const mergedFields = {
        name: qrFields.name || ocrFields.name || '',
        company: qrFields.company || ocrFields.company || null,
        designation: qrFields.designation || ocrFields.designation || null,
        email: qrFields.email || ocrFields.email || null,
        phone: qrFields.phone || ocrFields.phone || null,
        website: qrFields.website || ocrFields.website || null,
        address: qrFields.address || ocrFields.address || null,
        linkedin_url: qrFields.linkedin_url || ocrFields.linkedin_url || null,
      };

      // Run through existing Business Card OCR verification pipeline for ultimate accuracy
      const validation = await runGeminiOcrClassifier(result.ocr_text, mergedFields);

      return {
        decodedText,
        parsedFields: validation.fields,
        metadata: {
          format: 'QR_CODE_WITH_OCR',
          confidence: validation.understanding[0]?.confidence || 1.0,
          mimeType: file.mimetype,
          originalName: file.originalname,
        },
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`QR decoding failed: ${err.message}`, 500);
    }
  }

  public processQrText(decodedText: string) {
    if (!decodedText) {
      throw new AppError('No QR text provided', 400);
    }
    const parsedFields = parseContactString(decodedText);
    return {
      decodedText,
      parsedFields,
      metadata: {
        format: 'QR_CODE_LIVE',
        confidence: 1.0,
      },
    };
  }
}
