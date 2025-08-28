/**
 * 🎛️ CONTROLLER D'UPLOAD - API ENDPOINTS
 *
 * Endpoints RESTful pour le système d'upload
 * Compatible avec l'architecture NestJS
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService, UploadOptions, BulkUploadOptions } from './services/upload.service';
import { UploadType } from './dto/upload.dto';

@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  /**
   * Upload d'un fichier unique
   */
  @Post('single/:type')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Param('type') uploadType: UploadType,
    @Query('folder') folder?: string,
    @Query('validate') validate?: string,
  ) {
    if (!file) {
      throw new HttpException('Aucun fichier fourni', HttpStatus.BAD_REQUEST);
    }

    const options: UploadOptions = {
      uploadType,
      folder,
      validateFile: validate !== 'false',
    };

    try {
      const result = await this.uploadService.uploadFile(file, options);
      return {
        success: true,
        message: 'Fichier uploadé avec succès',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Upload failed:', error);
      throw new HttpException(
        error.message || 'Erreur lors de l\'upload',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Upload de plusieurs fichiers
   */
  @Post('multiple/:type')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Param('type') uploadType: UploadType,
    @Query('folder') folder?: string,
    @Query('continueOnError') continueOnError?: string,
  ) {
    if (!files || files.length === 0) {
      throw new HttpException('Aucun fichier fourni', HttpStatus.BAD_REQUEST);
    }

    const options: BulkUploadOptions = {
      uploadType,
      folder,
      continueOnError: continueOnError === 'true',
    };

    try {
      const result = await this.uploadService.uploadMultipleFiles(files, options);
      return {
        success: true,
        message: `${result.successful.length}/${files.length} fichiers uploadés`,
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Bulk upload failed:', error);
      throw new HttpException(
        error.message || 'Erreur lors de l\'upload en lot',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validation d'un fichier sans upload
   */
  @Post('validate/:type')
  @UseInterceptors(FileInterceptor('file'))
  async validateFile(
    @UploadedFile() file: Express.Multer.File,
    @Param('type') uploadType: UploadType,
  ) {
    if (!file) {
      throw new HttpException('Aucun fichier fourni', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.uploadService.validateFile(file, uploadType);
      return {
        success: true,
        message: result.isValid ? 'Fichier valide' : 'Fichier invalide',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Validation failed:', error);
      throw new HttpException(
        'Erreur lors de la validation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Suppression d'un fichier
   */
  @Delete(':filePath')
  async deleteFile(@Param('filePath') filePath: string) {
    try {
      const success = await this.uploadService.deleteFile(filePath);
      
      if (success) {
        return {
          success: true,
          message: 'Fichier supprimé avec succès',
        };
      } else {
        throw new HttpException(
          'Impossible de supprimer le fichier',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error: any) {
      this.logger.error('Delete failed:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la suppression',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtient les statistiques d'upload
   */
  @Get('stats')
  async getStats() {
    try {
      const stats = await this.uploadService.getUploadStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      this.logger.error('Stats failed:', error);
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtient la configuration pour un type d'upload
   */
  @Get('config/:type')
  async getConfig(@Param('type') uploadType: UploadType) {
    try {
      const config = this.uploadService.getUploadConfig(uploadType);
      return {
        success: true,
        data: config,
      };
    } catch (error: any) {
      throw new HttpException(
        'Type d\'upload invalide',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Health check du système d'upload
   */
  @Get('health')
  async healthCheck() {
    try {
      const health = await this.uploadService.healthCheck();
      return {
        success: health.status === 'healthy',
        data: health,
      };
    } catch (error: any) {
      this.logger.error('Health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Liste les fichiers d'un dossier
   */
  @Get('list/:folder')
  async listFiles(
    @Param('folder') folder: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const files = await this.uploadService.listFiles(
        folder,
        limit ? parseInt(limit) : undefined,
      );
      
      return {
        success: true,
        data: {
          folder,
          count: files.length,
          files,
        },
      };
    } catch (error: any) {
      this.logger.error('List files failed:', error);
      throw new HttpException(
        'Erreur lors de la récupération des fichiers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
