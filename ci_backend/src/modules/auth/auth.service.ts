import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { Role } from '@prisma/client';

export class AuthService {
  private generateAccessToken(user: { id: string; email: string; role: Role }) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
    );
  }

  private generateRefreshToken(user: { id: string; email: string; role: Role }) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );
  }

  public async register(data: any) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email address is already registered', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        password: hashedPassword,
        // The UI allows this field to be blank; the database requires a value.
        organization: data.organization || 'Individual',
        role: data.role || Role.USER,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTER',
        entity: 'User',
        entityId: user.id,
        details: { email: user.email, role: user.role },
      },
    }).catch(() => {});

    // Remove password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  public async login(data: any) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError('Invalid email or password credentials', 401);
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password credentials', 401);
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
      },
    }).catch(() => {});

    const { password, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  public async refresh(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string; email: string; role: Role };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        throw new AppError('User session not found', 401);
      }

      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  public async logout(userId: string) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_LOGOUT',
        entity: 'User',
        entityId: userId,
      },
    }).catch(() => {});
    return true;
  }

  public async forgotPassword(email: string) {
    // Return mocked success response
    logger.info(`[Auth Service] Password reset requested for: ${email}`);
    return {
      message: 'Password reset link sent to registered email address (mocked).',
    };
  }

  public async resetPassword(email: string) {
    // Return mocked success response
    logger.info(`[Auth Service] Password reset executed (mocked).`);
    return {
      message: 'Password has been reset successfully (mocked).',
    };
  }
}

import logger from '../../config/logger';
