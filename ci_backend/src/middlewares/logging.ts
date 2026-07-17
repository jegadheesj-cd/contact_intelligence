import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `HTTP Request: %s %s | Status: %d | Latency: %dms | IP: %s | UserAgent: %s`,
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent'] || 'Unknown'
    );
  });

  next();
};
