import { Request, Response, NextFunction } from 'express';
import { NfcService } from './nfc.service';

const nfcService = new NfcService();

export class NfcController {
  public async read(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const { contactId, payload } = req.body;
      const record = await nfcService.saveNfcData(req.user.id, contactId, payload);
      res.status(201).json({
        success: true,
        message: 'NFC payload successfully recorded and processed',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const record = await nfcService.getNfcData(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        message: 'NFC data retrieved successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }
}
