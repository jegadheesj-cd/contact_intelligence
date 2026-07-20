import { Request, Response, NextFunction } from 'express';
import { BusinessCardsService } from './business-cards.service';
import { AppError } from '../../utils/AppError';

const cardsService = new BusinessCardsService();

export class BusinessCardsController {
  public async uploadCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }

      if (!req.file) {
        throw new AppError('No business card file uploaded', 400);
      }

      const contactId = req.body.contactId; // optional

      const card = await cardsService.uploadCard(req.user.id, req.file, contactId);

      res.status(201).json({
        success: true,
        message: 'Business card image uploaded and OCR extraction queued',
        data: card,
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

      const card = await cardsService.getCard(req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Business card details retrieved successfully',
        data: card,
      });
    } catch (error) {
      next(error);
    }
  }

  public async deleteOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }

      await cardsService.deleteCard(req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Business card and original file deleted successfully',
        data: {},
      });
    } catch (error) {
      next(error);
    }
  }

}
