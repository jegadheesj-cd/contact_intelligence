import { Request, Response, NextFunction } from 'express';
import linkedinService from './linkedin.service';
import { AppError } from '../../utils/AppError';

export class LinkedInController {
  public async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, company } = req.body;
      if (!name) {
        throw new AppError('Name is required for searching LinkedIn Sales Navigator', 400);
      }
      const results = await linkedinService.searchProfiles(name, company);
      res.status(200).json({
        success: true,
        message: 'LinkedIn profiles search results',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await linkedinService.getProfileDetails(req.params.id);
      res.status(200).json({
        success: true,
        message: 'LinkedIn profile details',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
}
