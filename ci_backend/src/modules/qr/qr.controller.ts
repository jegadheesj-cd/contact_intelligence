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
}
