import { Request, Response, NextFunction } from 'express';
import { QrService } from './qr.service';
import { AppError } from '../../utils/AppError';

const qrService = new QrService();

export class QrController {
  public async read(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No QR image file uploaded', 400);
      }
      const data = await qrService.processQrImage(req.file);
      res.status(200).json({
        success: true,
        message: 'QR Code processed successfully (mocked output)',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async parseText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { decodedText } = req.body;
      if (!decodedText) {
        throw new AppError('No decodedText provided in request body', 400);
      }
      const data = await qrService.processQrText(decodedText);
      res.status(200).json({
        success: true,
        message: 'QR Code text processed successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
