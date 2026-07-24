import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { Role } from '@prisma/client';

interface JWTPayload {
  id: string;
  email: string;
  role: Role;
}

import prisma from '../config/db';

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token missing or malformed', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JWTPayload;
    
    // Verify user still exists in database
    const userExists = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!userExists) {
      return next(new AppError('User no longer exists', 401));
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Access token expired', 401, { code: 'TOKEN_EXPIRED' }));
    }
    return next(new AppError('Invalid access token', 401));
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication credentials not found', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Access denied: insufficient permissions', 403));
    }

    next();
  };
};
