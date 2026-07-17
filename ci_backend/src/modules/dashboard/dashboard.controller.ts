import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';

const dashboardService = new DashboardService();

export class DashboardController {
  public async getWidgets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const data = await dashboardService.getDashboardWidgets(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Dashboard widget statistics retrieved successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const data = await dashboardService.getAnalyticsMetrics(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Platform analytics metrics retrieved successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
