import { Request, Response, NextFunction } from 'express';
import { ProfileEnrichmentService } from './enrichment.service';
import { AppError } from '../../utils/AppError';

const enrichmentService = new ProfileEnrichmentService();

export class ProfileEnrichmentController {
  public async trigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const { contactId } = req.body;
      if (!contactId) {
        throw new AppError('contactId is required to trigger enrichment', 400);
      }
      const result = await enrichmentService.triggerEnrichment(req.user.id, contactId);
      res.status(202).json({
        success: true,
        message: 'Enrichment pipeline successfully queued',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

}
