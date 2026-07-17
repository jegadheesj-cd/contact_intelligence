import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import { faceRecognitionQueue } from '../../queue/queue';
import fs from 'fs';
import path from 'path';
import { scanFileForMalware, calculateFileHash } from '../../utils/fileSecurity';

export class FaceRecognitionService {
  public async processFaceMedia(userId: string, file: Express.Multer.File, contactId?: string) {
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

    // 2. Create FaceRecognition record
    const faceRecord = await prisma.faceRecognition.create({
      data: {
        contactId: contactId || null,
        uploadedFileId: uploadedFile.id,
      },
      include: {
        uploadedFile: true,
      },
    });

    // 3. Queue Face Recognition background processing
    await faceRecognitionQueue.add(
      'process-face',
      { faceRecognitionId: faceRecord.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );

    return faceRecord;
  }

  public async getFaceRecord(userId: string, faceRecordId: string) {
    const record = await prisma.faceRecognition.findUnique({
      where: { id: faceRecordId },
      include: {
        uploadedFile: true,
        contact: true,
      },
    });

    if (!record) {
      throw new AppError('Face recognition record not found', 404);
    }

    // Verify ownership
    if (record.uploadedFile.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return record;
  }

  public async enrollFace(userId: string, contactId: string, file: Express.Multer.File) {
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
        checksum,
        checksumAlgo: 'sha256',
        userId,
        contactId,
      },
    });

    // 4. Run face_processor.py to extract embedding
    const scriptPath = path.resolve(__dirname, '../../scripts/face_processor.py');
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFilePromise = promisify(execFile);

    try {
      const { stdout } = await execFilePromise('python', [scriptPath, 'detect', file.path, 'false']);
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) throw new Error("JSON payload not found in python output");
      const result = JSON.parse(stdout.substring(jsonStart));

      if (!result.success || !result.face_detected) {
        // Clean up file if no face detected
        fs.unlinkSync(file.path);
        await prisma.uploadedFile.delete({ where: { id: uploadedFile.id } }).catch(() => {});
        throw new AppError(result.message || 'No face detected in the uploaded photo for enrollment.', 400);
      }

      // 5. Create FaceRecognition record marked as enrolled
      const faceRecord = await prisma.faceRecognition.create({
        data: {
          contactId,
          uploadedFileId: uploadedFile.id,
          status: 'COMPLETED',
          recognizedResult: {
            embedding: result.embedding,
            bbox: result.bbox,
            isEnrolled: true,
          },
        },
      });

      return faceRecord;
    } catch (err: any) {
      // Clean up on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      await prisma.uploadedFile.delete({ where: { id: uploadedFile.id } }).catch(() => {});
      if (err instanceof AppError) throw err;
      throw new AppError(`Face enrollment process failed: ${err.message}`, 500);
    }
  }

  public async listEnrolledFaces(userId: string) {
    return await prisma.faceRecognition.findMany({
      where: {
        status: 'COMPLETED',
        contact: {
          userId: userId,
        },
        recognizedResult: {
          path: ['isEnrolled'],
          equals: true,
        },
      },
      include: {
        contact: true,
        uploadedFile: true,
      },
    });
  }

  public async deleteEnrolledFace(userId: string, faceId: string) {
    const record = await prisma.faceRecognition.findFirst({
      where: {
        id: faceId,
        contact: {
          userId: userId,
        },
      },
      include: {
        uploadedFile: true,
      },
    });

    if (!record) {
      throw new AppError('Enrolled face signature not found', 404);
    }

    // Delete database records
    await prisma.faceRecognition.delete({ where: { id: faceId } });
    
    if (record.uploadedFile) {
      const filePath = path.resolve(record.uploadedFile.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await prisma.uploadedFile.delete({ where: { id: record.uploadedFileId } }).catch(() => {});
    }

    return true;
  }

  public async matchFaceAgainstEnrolled(userId: string, mediaPath: string, isVideo: boolean) {
    // 1. Run face_processor.py detect to extract the target embedding from the media file
    const scriptPath = path.resolve(__dirname, '../../scripts/face_processor.py');
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFilePromise = promisify(execFile);

    let targetResult: any;
    try {
      const { stdout } = await execFilePromise('python', [
        scriptPath,
        'detect',
        mediaPath,
        isVideo ? 'true' : 'false',
      ]);
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) throw new Error("JSON payload not found in python output");
      targetResult = JSON.parse(stdout.substring(jsonStart));
    } catch (err: any) {
      throw new AppError(`Target face extraction failed: ${err.message}`, 500);
    }

    if (!targetResult.success || !targetResult.face_detected) {
      return { matched: false, message: 'No face detected in uploaded media.' };
    }

    const targetEmbedding = targetResult.embedding;

    // 2. Dynamically check if pgvector extension is available in Postgres
    let isPgVectorAvailable = false;
    try {
      await prisma.$executeRawUnsafe(`SELECT '[]'::vector;`);
      isPgVectorAvailable = true;
    } catch (_) {}

    // 3. Match using pgvector or fall back to JS similarity calculation
    const threshold = 0.60;

    if (isPgVectorAvailable) {
      const targetVectorStr = `[${targetEmbedding.join(',')}]`;
      const results: any[] = await prisma.$queryRawUnsafe(`
        SELECT 
          fr.id,
          fr."contactId",
          (1 - (cast(fr."recognizedResult"->>'embedding' as jsonb)::text::vector <=> $1::vector))::double precision as "similarityScore"
        FROM face_recognitions fr
        INNER JOIN contacts c ON fr."contactId" = c.id
        WHERE c."userId" = $2 AND fr."recognizedResult"->>'embedding' IS NOT NULL
        ORDER BY cast(fr."recognizedResult"->>'embedding' as jsonb)::text::vector <=> $1::vector
        LIMIT 1
      `, targetVectorStr, userId);

      const bestMatch = results[0];
      if (bestMatch && bestMatch.similarityScore >= threshold) {
        return {
          matched: true,
          contactId: bestMatch.contactId,
          similarityScore: bestMatch.similarityScore,
          boundingBox: targetResult.bbox,
          det_score: targetResult.det_score
        };
      } else {
        return {
          matched: false,
          similarityScore: bestMatch ? bestMatch.similarityScore : 0.0,
          message: "Face detected, but no matching enrolled contact was found in the database."
        };
      }
    } else {
      // Fallback: Perform comparison in JS
      const enrolledFaces = await this.listEnrolledFaces(userId);
      if (enrolledFaces.length === 0) {
        return { matched: false, message: 'No enrolled faces in database to compare against.' };
      }

      let bestMatch: any = null;
      let highestScore = -1.0;

      for (const face of enrolledFaces) {
        const res = face.recognizedResult as any;
        if (!res || !res.embedding) continue;
        const score = cosineSimilarity(targetEmbedding, res.embedding);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = face;
        }
      }

      if (bestMatch && highestScore >= threshold) {
        return {
          matched: true,
          contactId: bestMatch.contactId,
          similarityScore: highestScore,
          boundingBox: targetResult.bbox,
          det_score: targetResult.det_score
        };
      } else {
        return {
          matched: false,
          similarityScore: highestScore >= 0 ? highestScore : 0.0,
          message: "Face detected, but no matching enrolled contact was found in the database."
        };
      }
    }
  }
}

function dotProduct(a: number[], b: number[]): number {
  let product = 0;
  for (let i = 0; i < a.length; i++) {
    product += a[i] * b[i];
  }
  return product;
}

function magnitude(a: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}
