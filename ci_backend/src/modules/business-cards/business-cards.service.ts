import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import { ocrQueue } from '../../queue/queue';
import fs from 'fs';
import path from 'path';

import { scanFileForMalware, calculateFileHash } from '../../utils/fileSecurity';

export class BusinessCardsService {
  public async uploadCard(userId: string, file: Express.Multer.File, contactId?: string) {
    // 1. Scan file for malware
    const scan = await scanFileForMalware(file.path, file.originalname, file.mimetype);
    if (!scan.safe) {
      fs.unlinkSync(file.path);
      throw new AppError(scan.reason || 'File validation failed security scanning', 400);
    }

    // 2. Compute checksum
    const checksum = await calculateFileHash(file.path);

    // 3. Create UploadedFile record
    const urlPath = `/uploads/${file.filename}`;
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        url: urlPath,
        checksum: checksum,
        checksumAlgo: 'sha256',
        userId,
        contactId: contactId || null,
      },
    });

    // 2. Create BusinessCard record
    const businessCard = await prisma.businessCard.create({
      data: {
        contactId: contactId || null,
        uploadedFileId: uploadedFile.id,
      },
      include: {
        uploadedFile: true,
      },
    });

    // 3. Queue OCR background job
    await ocrQueue.add(
      'process-ocr',
      { businessCardId: businessCard.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );

    return businessCard;
  }

  public async getCard(userId: string, cardId: string) {
    const card = await prisma.businessCard.findFirst({
      where: {
        id: cardId,
        uploadedFile: { userId },
      },
      include: {
        uploadedFile: true,
        contact: true,
      },
    });

    if (!card) {
      throw new AppError('Business card not found or access denied', 404);
    }

    return card;
  }

  public async deleteCard(userId: string, cardId: string) {
    const card = await this.getCard(userId, cardId);

    // Delete record from database
    await prisma.businessCard.delete({
      where: { id: cardId },
    });

    // Attempt to delete physical file
    const filePath = path.resolve(card.uploadedFile.path);
    fs.unlink(filePath, (err) => {
      if (err) {
        // Log warning but don't fail request
        console.warn(`[Business Cards] Warning: failed to delete physical file: ${filePath}`);
      }
    });

    // Clean up uploaded file record
    await prisma.uploadedFile.delete({
      where: { id: card.uploadedFileId },
    }).catch(() => {});

    return true;
  }
}
