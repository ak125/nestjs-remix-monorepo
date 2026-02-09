/**
 * 🗄️ SERVICE DE STOCKAGE SUPABASE SIMPLIFIÉ
 * Interface avec Supabase Storage pour upload de fichiers
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { FileUploadResult } from '../dto/upload.dto';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

@Injectable()
export class SupabaseStorageService extends SupabaseBaseService {
  private readonly bucketName: string;

  constructor(configService: ConfigService) {
    super(configService);
    this.bucketName = configService.get('SUPABASE_STORAGE_BUCKET') || 'uploads';
    this.logger.log('🗄️ SupabaseStorageService initialized');
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<FileUploadResult> {
    try {
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          // 🚀 LCP Optimization: 1 an de cache pour assets statiques (PageSpeed audit)
          cacheControl: '31536000',
        });

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.STORAGE_ERROR,
          message: `Supabase upload error: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      const {
        data: { publicUrl },
      } = this.supabase.storage.from(this.bucketName).getPublicUrl(filePath);

      return {
        id: data.path, // Utiliser le path comme id
        fileName,
        originalName: file.originalname,
        url: publicUrl,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Upload error: ${message}`);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        this.logger.error(`❌ Delete error: ${error.message}`);
        return false;
      }

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Delete error: ${message}`);
      return false;
    }
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.STORAGE_ERROR,
          message: `Signed URL error: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      return data.signedUrl;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Signed URL error: ${message}`);
      throw error;
    }
  }

  async listFiles(folder: string, limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(folder, {
          limit,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.STORAGE_ERROR,
          message: `List files error: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      return data || [];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ List files error: ${message}`);
      return [];
    }
  }

  async getBucketInfo(): Promise<any> {
    try {
      const { data, error } = await this.supabase.storage.getBucket(
        this.bucketName,
      );

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.STORAGE_ERROR,
          message: `Bucket info error: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Bucket info error: ${message}`);
      throw error;
    }
  }
}
