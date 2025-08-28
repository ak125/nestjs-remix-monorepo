/**
 * 📁 MODULE D'UPLOAD MODERNE - ARCHITECTURE AVANCÉE
 *
 * ✅ Supabase Storage intégré
 * ✅ Traitement d'images automatique
 * ✅ Validation et sécurité avancée
 * ✅ Cache intelligent et optimisé
 * ✅ Support multi-formats et redimensionnement
 * ✅ Analytics et monitoring
 */

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../../cache/cache.module';

import { UploadController } from './upload.controller';
import { UploadService } from './services/upload.service';
import { ImageProcessingService } from './services/image-processing.service';
import { SupabaseStorageService } from './services/supabase-storage.service';
import { FileValidationService } from './services/file-validation.service';
import { UploadAnalyticsService } from './services/upload-analytics.service';
import { UploadOptimizationService } from './services/upload-optimization.service';

@Module({
  imports: [
    ConfigModule,
    CacheModule,
    MulterModule.register({
      limits: {
        fileSize:
          process.env.NODE_ENV === 'production'
            ? 50 * 1024 * 1024
            : 100 * 1024 * 1024, // 50MB prod, 100MB dev
        files: 10,
        fields: 10,
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/avif',
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/zip',
          'application/x-zip-compressed',
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'audio/mpeg',
          'audio/wav',
          'audio/ogg',
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(`Type de fichier non supporté: ${file.mimetype}`),
            false,
          );
        }
      },
    }),
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    ImageProcessingService,
    SupabaseStorageService,
    FileValidationService,
    UploadAnalyticsService,
    UploadOptimizationService,
  ],
  exports: [UploadService, ImageProcessingService, SupabaseStorageService],
})
export class UploadModule {}
