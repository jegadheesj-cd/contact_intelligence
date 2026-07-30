import fs from 'fs';
import path from 'path';
import { IReverseFaceSearchProvider, ReverseFaceSearchResponse, FaceCandidate } from './IReverseFaceSearchProvider';
import { AppError } from '../../../utils/AppError';
import logger from '../../../config/logger';

export class GoogleReverseImageProvider implements IReverseFaceSearchProvider {
  public readonly name = 'GoogleReverseImage';

  /**
   * Helper to perform HTTP POST file upload with timeout
   */
  private async executeUpload(url: string, formData: FormData, timeoutMs: number = 10000): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      return await response.text();
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Uploads file to litterbox.catbox.moe (temporary upload)
   */
  private async uploadToLitterbox(imagePath: string): Promise<string> {
    logger.info(`[GoogleReverseImageProvider] Attempting temporary upload to litterbox.catbox.moe`);
    const fileBuffer = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '1h');
    formData.append('fileToUpload', blob, filename);

    const responseText = await this.executeUpload('https://litterbox.catbox.moe/resources/internals/api.php', formData, 12000);
    const directUrl = responseText.trim();
    if (directUrl.startsWith('http')) {
      logger.info(`[GoogleReverseImageProvider] Successfully hosted image on Litterbox: ${directUrl}`);
      return directUrl;
    }
    throw new Error(`Litterbox returned invalid output: ${directUrl}`);
  }

  /**
   * Uploads file to catbox.moe (permanent anonymous upload)
   */
  private async uploadToCatbox(imagePath: string): Promise<string> {
    logger.info(`[GoogleReverseImageProvider] Attempting upload to catbox.moe`);
    const fileBuffer = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', blob, filename);

    const responseText = await this.executeUpload('https://catbox.moe/user/api.php', formData, 12000);
    const directUrl = responseText.trim();
    if (directUrl.startsWith('http')) {
      logger.info(`[GoogleReverseImageProvider] Successfully hosted image on Catbox: ${directUrl}`);
      return directUrl;
    }
    throw new Error(`Catbox returned invalid output: ${directUrl}`);
  }

  /**
   * Uploads local file to tmpfiles.org
   */
  private async uploadToTmpFiles(imagePath: string): Promise<string> {
    logger.info(`[GoogleReverseImageProvider] Attempting upload to tmpfiles.org`);
    const fileBuffer = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, filename);

    const responseText = await this.executeUpload('https://tmpfiles.org/api/v1/upload', formData, 12000);
    const json = JSON.parse(responseText);
    if (json && json.status === 'success' && json.data && json.data.url) {
      const rawUrl = json.data.url;
      const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      logger.info(`[GoogleReverseImageProvider] Successfully hosted image on tmpfiles: ${directUrl}`);
      return directUrl;
    }
    throw new Error('Invalid JSON from tmpfiles.org');
  }

  /**
   * Uploads file to file.io
   */
  private async uploadToFileIo(imagePath: string): Promise<string> {
    logger.info(`[GoogleReverseImageProvider] Attempting upload to file.io`);
    const fileBuffer = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, filename);

    const responseText = await this.executeUpload('https://file.io/', formData, 12000);
    const json = JSON.parse(responseText);
    if (json && json.success && json.link) {
      logger.info(`[GoogleReverseImageProvider] Successfully hosted image on file.io: ${json.link}`);
      return json.link;
    }
    throw new Error('Invalid JSON from file.io');
  }

  /**
   * Helper to crop face from image using python face_processor.py
   */
  private async cropFaceFromImage(imagePath: string): Promise<string> {
    const scriptPath = path.resolve(__dirname, '../../../scripts/face_processor.py');
    const croppedPath = path.join(
      path.dirname(imagePath),
      `cropped_face_${Date.now()}_${path.basename(imagePath)}`
    );
    
    logger.info(`[GoogleReverseImageProvider] Cropping face from image: ${imagePath} to ${croppedPath}`);
    
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFilePromise = promisify(execFile);
    
    try {
      const { stdout } = await execFilePromise('python', [scriptPath, 'crop-face', imagePath, croppedPath]);
      const jsonLine = stdout.split('\n').find((line: string) => line.trim().startsWith('{'));
      if (jsonLine) {
        const result = JSON.parse(jsonLine.trim());
        if (result.success && result.face_detected) {
          logger.info(`[GoogleReverseImageProvider] Face successfully cropped.`);
          return croppedPath;
        }
      }
      logger.info(`[GoogleReverseImageProvider] Face detection failed or no face. Using original image.`);
      return imagePath;
    } catch (err: any) {
      logger.warn(`[GoogleReverseImageProvider] Face cropping failed: ${err.message}. Using original image.`);
      return imagePath;
    }
  }

  public async search(imagePath: string): Promise<ReverseFaceSearchResponse> {
    const apiKey = process.env.SERPAPI_API_KEY;
    
    if (!apiKey) {
      logger.warn('[GoogleReverseImageProvider] SerpApi API key missing.');
      throw new AppError('SerpApi API key not configured.', 500);
    }

    let searchImagePath = imagePath;
    try {
      searchImagePath = await this.cropFaceFromImage(imagePath);
    } catch (cropErr: any) {
      logger.warn(`[GoogleReverseImageProvider] Face cropping execution error: ${cropErr.message}`);
    }

    let publicUrl = '';
    const uploadErrors: string[] = [];

    // Fallback pipeline for hosting images temporarily
    const uploaders = [
      () => this.uploadToLitterbox(searchImagePath),
      () => this.uploadToCatbox(searchImagePath),
      () => this.uploadToTmpFiles(searchImagePath),
      () => this.uploadToFileIo(searchImagePath)
    ];

    try {
      for (const uploader of uploaders) {
        try {
          publicUrl = await uploader();
          if (publicUrl) break;
        } catch (err: any) {
          uploadErrors.push(err.message);
          logger.warn(`[GoogleReverseImageProvider] Image upload option failed: ${err.message}`);
        }
      }

      if (!publicUrl) {
        logger.error(`[GoogleReverseImageProvider] All temporary upload options failed: ${uploadErrors.join('; ')}`);
        return {
          success: false,
          provider: this.name,
          candidates: [],
          message: `Image hosting failed: ${uploadErrors.join(', ')}`,
        };
      }

      // 2. Query SerpApi Google Lens API with timeout
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout for query

      try {
        logger.info(`[GoogleReverseImageProvider] Querying SerpApi Google Lens for matching pages using: ${publicUrl}`);
        
        const params = new URLSearchParams({
          engine: 'google_lens',
          url: publicUrl,
          api_key: apiKey,
        });

        const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutTimer);

        if (!response.ok) {
          throw new Error(`SerpApi query failed: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json() as any;
        const candidates: FaceCandidate[] = [];

        // Google Lens returns matching pages inside visual_matches array
        if (rawData && Array.isArray(rawData.visual_matches)) {
          for (const item of rawData.visual_matches) {
            if (item.link) {
              candidates.push({
                url: item.link,
                source: item.source || 'Google Lens Search',
                confidence: 85,
                title: item.title || '',
              });
            }
          }
        }

        logger.info(`[GoogleReverseImageProvider] Completed successfully. Found ${candidates.length} visual matches.`);

        return {
          success: true,
          provider: this.name,
          candidates,
          message: `Search completed. Discovered ${candidates.length} matches.`,
        };
      } catch (error: any) {
        clearTimeout(timeoutTimer);
        logger.error(`[GoogleReverseImageProvider] Search query failed or timed out: ${error.message}`);
        return {
          success: false,
          provider: this.name,
          candidates: [],
          error: error.message,
        };
      }
    } finally {
      // Clean up temporary cropped image file if created
      if (searchImagePath !== imagePath) {
        fs.unlink(searchImagePath, (err) => {
          if (err) logger.warn(`[GoogleReverseImageProvider] Failed to clean up cropped file: ${searchImagePath}`);
          else logger.info(`[GoogleReverseImageProvider] Cleaned up cropped file: ${searchImagePath}`);
        });
      }
    }
  }
}
