/**
 * 📁 SERVICE PRINCIPAL D'UPLOAD
 *
 * Orchestration complète du système d'upload
 * Intégration avec tous les services spécialisés
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseStorageService } from './supabase-storage.service';
import { FileValidationService } from './file-validation.service';
import { UploadAnalyticsService } from './upload-analytics.service';
import {
  FileUploadResult,
  BulkUploadResult,
  UploadType,
} from '../dto/upload.dto';

export interface UploadOptions {
  uploadType: UploadType;
  folder?: string;
  validateFile?: boolean;
  generateThumbnails?: boolean;
  compressionLevel?: number;
  customFileName?: string;
  metadata?: Record<string, any>;
}

export interface BulkUploadOptions extends UploadOptions {
  maxConcurrentUploads?: number;
  continueOnError?: boolean;
  generateReport?: boolean;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly defaultFolder = 'uploads';

  constructor(
    private configService: ConfigService,
    private supabaseStorageService: SupabaseStorageService,
    private fileValidationService: FileValidationService,
    private uploadAnalyticsService: UploadAnalyticsService,
  ) {
    this.logger.log('📁 UploadService initialized');
  }

  /**
   * Upload un fichier unique
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<FileUploadResult> {
    const startTime = Date.now();
    this.logger.log(
      `🔄 Starting upload: ${file.originalname} (${file.size} bytes) as ${options.uploadType}`,
    );

    try {
      // 1. Validation du fichier si demandée
      if (options.validateFile !== false) {
        const validationResult = await this.fileValidationService.validateFile(
          file,
          options.uploadType,
        );

        if (!validationResult.isValid) {
          const errorMessage = `Validation échouée: ${validationResult.errors.join(', ')}`;
          await this.uploadAnalyticsService.recordUploadFailure(
            file.originalname,
            errorMessage,
            {
              uploadType: options.uploadType,
              ...options.metadata,
            },
          );

          throw new BadRequestException(errorMessage);
        }

        // Log des warnings
        if (validationResult.warnings.length > 0) {
          this.logger.warn(
            `⚠️ Validation warnings for ${file.originalname}: ${validationResult.warnings.join(', ')}`,
          );
        }
      }

      // 2. Détermination du dossier de destination
      const folder = this.determineUploadFolder(
        options.folder,
        options.uploadType,
      );

      // 3. Upload vers le storage
      const uploadResult = await this.supabaseStorageService.uploadFile(
        file,
        folder,
      );

      // 4. Enrichissement des métadonnées
      uploadResult.metadata = {
        ...uploadResult.metadata,
        ...options.metadata,
        validationPassed: options.validateFile !== false,
        uploadTimeMs: Date.now() - startTime,
      };

      // 5. Enregistrement analytics
      await this.uploadAnalyticsService.recordUpload(uploadResult);

      this.logger.log(
        `✅ Upload completed: ${uploadResult.fileName} in ${uploadResult.metadata?.uploadTimeMs}ms`,
      );

      return uploadResult;
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur inconnue';

      // Enregistrement de l'échec
      await this.uploadAnalyticsService.recordUploadFailure(
        file.originalname,
        errorMessage,
        {
          uploadType: options.uploadType,
          ...options.metadata,
        },
      );

      this.logger.error(
        `❌ Upload failed for ${file.originalname}:`,
        error.message,
      );

      // Re-throw avec le bon type d'exception
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new HttpException(
        `Échec de l'upload: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Upload de multiples fichiers
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    options: BulkUploadOptions,
  ): Promise<BulkUploadResult> {
    this.logger.log(
      `🔄 Starting bulk upload: ${files.length} files as ${options.uploadType}`,
    );

    const result: BulkUploadResult = {
      successful: [],
      failed: [],
      summary: {
        totalFiles: files.length,
        successfulUploads: 0,
        failedUploads: 0,
        totalSize: 0,
        totalUploadTime: 0,
      },
    };

    const startTime = Date.now();
    const maxConcurrent = options.maxConcurrentUploads || 5;

    // Traitement en batches
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);

      // Upload parallèle du batch
      const batchResults = await Promise.allSettled(
        batch.map(async (file, index) => {
          try {
            const fileOptions: UploadOptions = {
              ...options,
              metadata: {
                ...options.metadata,
                batchIndex: i + index,
                batchSize: files.length,
              },
            };

            const uploadResult = await this.uploadFile(file, fileOptions);

            result.successful.push(uploadResult);
            result.summary.totalSize += uploadResult.size;

            return { success: true, file, result: uploadResult };
          } catch (error: any) {
            const failureInfo = {
              file: file.originalname,
              error: error.message || String(error),
            };

            result.failed.push(failureInfo);

            if (!options.continueOnError) {
              throw error;
            }

            return { success: false, file, error };
          }
        }),
      );

      // Vérification des échecs si continueOnError est false
      if (!options.continueOnError) {
        const failures = batchResults.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
          break;
        }
      }
    }

    // Calcul des statistiques finales
    result.summary.successfulUploads = result.successful.length;
    result.summary.failedUploads = result.failed.length;
    result.summary.totalUploadTime = Date.now() - startTime;

    this.logger.log(
      `✅ Bulk upload completed: ${result.summary.successfulUploads}/${files.length} successful in ${result.summary.totalUploadTime}ms`,
    );

    return result;
  }

  /**
   * Supprime un fichier
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      this.logger.log(`🗑️ Deleting file: ${filePath}`);

      const success = await this.supabaseStorageService.deleteFile(filePath);

      if (success) {
        this.logger.log(`✅ File deleted successfully: ${filePath}`);
      } else {
        this.logger.warn(`⚠️ File deletion failed: ${filePath}`);
      }

      return success;
    } catch (error: any) {
      this.logger.error(`❌ Delete error for ${filePath}:`, error.message);
      return false;
    }
  }

  /**
   * Obtient une URL signée temporaire
   */
  async getSignedUrl(
    filePath: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    try {
      return await this.supabaseStorageService.getSignedUrl(
        filePath,
        expiresInSeconds,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to generate signed URL for ${filePath}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Liste les fichiers d'un dossier
   */
  async listFiles(folder: string, limit: number = 100): Promise<any[]> {
    try {
      return await this.supabaseStorageService.listFiles(folder, limit);
    } catch (error: any) {
      this.logger.error(`❌ Failed to list files in ${folder}:`, error.message);
      return [];
    }
  }

  /**
   * Obtient les informations d'un fichier
   */
  async getFileInfo(filePath: string): Promise<any> {
    try {
      // Pour l'instant, on utilise les capacités de base de Supabase
      // On pourrait étendre avec des métadonnées stockées en base
      const files = await this.supabaseStorageService.listFiles(
        filePath.split('/').slice(0, -1).join('/'),
        1000,
      );

      const fileName = filePath.split('/').pop();
      const fileInfo = files.find((f) => f.name === fileName);

      return fileInfo || null;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to get file info for ${filePath}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Valide un fichier sans l'uploader
   */
  async validateFile(
    file: Express.Multer.File,
    uploadType: UploadType,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    securityScore: number;
  }> {
    try {
      const result = await this.fileValidationService.validateFile(
        file,
        uploadType,
      );

      return {
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        securityScore: result.securityScore,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Validation failed for ${file.originalname}:`,
        error.message,
      );

      return {
        isValid: false,
        errors: [`Erreur de validation: ${error.message}`],
        warnings: [],
        securityScore: 0,
      };
    }
  }

  /**
   * Obtient les statistiques d'upload
   */
  async getUploadStats(): Promise<{
    todayUploads: number;
    totalSize: number;
    averageSize: number;
    topMimeTypes: Array<{ type: string; count: number }>;
  }> {
    try {
      return await this.uploadAnalyticsService.getQuickStats();
    } catch (error: any) {
      this.logger.error('❌ Failed to get upload stats:', error.message);
      return {
        todayUploads: 0,
        totalSize: 0,
        averageSize: 0,
        topMimeTypes: [],
      };
    }
  }

  /**
   * Nettoie les anciens fichiers
   */
  async cleanupOldFiles(retentionDays: number = 90): Promise<number> {
    try {
      this.logger.log(
        `🧹 Starting cleanup of files older than ${retentionDays} days`,
      );

      // Pour l'instant, on nettoie juste les analytics
      // On pourrait étendre pour nettoyer aussi les fichiers du storage
      const cleanedCount =
        await this.uploadAnalyticsService.cleanupOldData(retentionDays);

      this.logger.log(`✅ Cleanup completed: ${cleanedCount} records cleaned`);
      return cleanedCount;
    } catch (error: any) {
      this.logger.error('❌ Cleanup failed:', error.message);
      return 0;
    }
  }

  /**
   * Génère un rapport d'utilisation
   */
  async generateUsageReport(startDate: Date, endDate: Date): Promise<any> {
    try {
      return await this.uploadAnalyticsService.generateReport(
        startDate,
        endDate,
      );
    } catch (error: any) {
      this.logger.error('❌ Failed to generate usage report:', error.message);
      throw new HttpException(
        'Impossible de générer le rapport',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Détermine le dossier d'upload selon le type
   */
  private determineUploadFolder(
    customFolder: string | undefined,
    uploadType: UploadType,
  ): string {
    if (customFolder) {
      return customFolder;
    }

    const folderMap = {
      [UploadType.AVATAR]: 'avatars',
      [UploadType.DOCUMENT]: 'documents',
      [UploadType.MEDIA]: 'media',
      [UploadType.ATTACHMENT]: 'attachments',
    };

    return folderMap[uploadType] || this.defaultFolder;
  }

  /**
   * Obtient la configuration d'upload pour un type donné
   */
  getUploadConfig(uploadType: UploadType): {
    maxSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
  } {
    // Configuration par défaut - peut être surchargée par la config
    const defaultConfig = {
      [UploadType.AVATAR]: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      },
      [UploadType.DOCUMENT]: {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        allowedExtensions: ['.pdf', '.doc', '.docx'],
      },
      [UploadType.MEDIA]: {
        maxSize: 200 * 1024 * 1024, // 200MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'video/mp4',
          'audio/mpeg',
        ],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.mp4', '.mp3'],
      },
      [UploadType.ATTACHMENT]: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedMimeTypes: ['*'],
        allowedExtensions: ['*'],
      },
    };

    return defaultConfig[uploadType];
  }

  /**
   * Vérifie si le service est opérationnel
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      storage: boolean;
      validation: boolean;
      analytics: boolean;
    };
    metrics: any;
  }> {
    try {
      // Test du storage
      const storageHealthy = await this.testStorageHealth();

      // Test des métriques
      const metrics = await this.uploadAnalyticsService.getRealTimeMetrics();

      return {
        status: storageHealthy ? 'healthy' : 'unhealthy',
        services: {
          storage: storageHealthy,
          validation: true, // Service local, toujours disponible
          analytics: true, // Service local, toujours disponible
        },
        metrics,
      };
    } catch (error: any) {
      this.logger.error('❌ Health check failed:', error.message);
      return {
        status: 'unhealthy',
        services: {
          storage: false,
          validation: false,
          analytics: false,
        },
        metrics: {},
      };
    }
  }

  /**
   * Test de santé du storage
   */
  private async testStorageHealth(): Promise<boolean> {
    try {
      await this.supabaseStorageService.getBucketInfo();
      return true;
    } catch {
      return false;
    }
  }
}
