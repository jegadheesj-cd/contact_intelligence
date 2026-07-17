import { Request, Response, NextFunction } from 'express';
import { AiSummaryService } from './ai-summary.service';
import { AppError } from '../../utils/AppError';

const aiService = new AiSummaryService();

export class AiSummaryController {
  public async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }

      const { contactId } = req.body;
      if (!contactId) {
        throw new AppError('contactId is required in request body to generate summary', 400);
      }

      const summary = await aiService.generateSummary(req.user.id, contactId);

      res.status(200).json({
        success: true,
        message: 'AI Contact summary generated successfully',
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
