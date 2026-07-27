import { Request, Response, NextFunction } from 'express';
import { FaceRecognitionService } from './face.service';
import { AppError } from '../../utils/AppError';

const faceService = new FaceRecognitionService();

export class FaceRecognitionController {
  public async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }

      if (!req.file) {
        throw new AppError('No photo file uploaded', 400);
      }

      const contactId = req.body.contactId;

      const record = await faceService.processFaceMedia(req.user.id, req.file, contactId);

      res.status(201).json({
        success: true,
        message: 'Face photo uploaded and biometrics queue triggered',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  public async uploadVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }

      if (!req.file) {
        throw new AppError('No video file uploaded', 400);
      }

      const contactId = req.body.contactId;

      const record = await faceService.processFaceMedia(req.user.id, req.file, contactId);

      res.status(201).json({
        success: true,
        message: 'Face video uploaded and biometrics queue triggered',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }

      const record = await faceService.getFaceRecord(req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Face recognition details retrieved successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }

      const progress = await faceService.getJobProgress(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Face recognition progress retrieved',
        data: { progress },
      });
    } catch (error) {
      next(error);
    }
  }

  public async enroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      if (!req.file) {
        throw new AppError('No photo file uploaded', 400);
      }
      const { contactId } = req.body;
      if (!contactId) {
        throw new AppError('contactId is required to enroll a face signature', 400);
      }

      const record = await faceService.enrollFace(req.user.id, contactId, req.file);
      res.status(201).json({
        success: true,
        message: 'Face signature successfully enrolled',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      const records = await faceService.listEnrolledFaces(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Enrolled face signatures retrieved successfully',
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }

  public async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      await faceService.deleteEnrolledFace(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        message: 'Enrolled face signature successfully deleted',
        data: {},
      });
    } catch (error) {
      next(error);
    }
  }

  public async listHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized', error: {} });
        return;
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const provider = req.query.provider as string;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

      const history = await faceService.listSearchHistory(req.user.id, page, limit, status, provider, sortBy, order);
      
      res.status(200).json({
        success: true,
        message: 'Face search history retrieved successfully',
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
}
