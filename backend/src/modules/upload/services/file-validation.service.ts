/**
 * 🛡️ SERVICE DE VALIDATION DES FICHIERS
 *
 * Validation complète et sécurisée des fichiers uploadés
 * Compatible avec les standards de sécurité moderne
 */

import { Injectable, Logger } from '@nestjs/common';
import { UploadType } from '../dto/upload.dto';
import { fileTypeFromBuffer } from 'file-type';
import * as crypto from 'crypto';
import * as path from 'path';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedType?: {
    ext: string;
    mime: string;
  };
  securityScore: number;
}

export interface ValidationOptions {
  allowedMimeTypes?: string[];
  maxSize?: number;
  minSize?: number;
  allowedExtensions?: string[];
  requireSignatureCheck?: boolean;
  scanForMalware?: boolean;
  customValidators?: Array<(file: Express.Multer.File) => Promise<boolean>>;
}

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  // Configuration par défaut
  private readonly defaultLimits = {
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
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
    },
    [UploadType.ATTACHMENT]: {
      maxSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: ['*'], // Plus permissif
      allowedExtensions: ['*'], // Plus permissif
    },
    [UploadType.MEDIA]: {
      maxSize: 200 * 1024 * 1024, // 200MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
      ],
      allowedExtensions: [
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.gif',
        '.mp4',
        '.webm',
        '.mp3',
        '.wav',
      ],
    },
  };

  // Signatures de fichiers dangereux
  private readonly dangerousSignatures = [
    { name: 'PE Executable', signature: [0x4d, 0x5a] },
    { name: 'ELF Executable', signature: [0x7f, 0x45, 0x4c, 0x46] },
    { name: 'Java Class', signature: [0xca, 0xfe, 0xba, 0xbe] },
    { name: 'ZIP with executable', signature: [0x50, 0x4b, 0x03, 0x04] },
  ];

  constructor() {
    this.logger.log('🛡️ FileValidationService initialized');
  }

  /**
   * Valide un fichier selon le type d'upload
   */
  async validateFile(
    file: Express.Multer.File,
    uploadType: UploadType,
    customOptions?: ValidationOptions,
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    this.logger.log(
      `🔍 Validating file: ${file.originalname} (${file.size} bytes) for ${uploadType}`,
    );

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityScore: 100,
    };

    try {
      // Configuration de validation
      const config = {
        ...this.defaultLimits[uploadType],
        ...customOptions,
      };

      // 1. Validation de la taille
      await this.validateSize(file, config, result);

      // 2. Validation du type MIME
      await this.validateMimeType(file, config, result);

      // 3. Validation de l'extension
      await this.validateExtension(file, config, result);

      // 4. Détection du type réel du fichier
      if (config.requireSignatureCheck !== false) {
        await this.validateFileSignature(file, result);
      }

      // 5. Analyse de sécurité
      await this.performSecurityAnalysis(file, result);

      // 6. Validations personnalisées
      if (customOptions?.customValidators?.length) {
        await this.runCustomValidators(
          file,
          customOptions.customValidators,
          result,
        );
      }

      // 7. Score final
      this.calculateFinalScore(result);

      const validationTime = Date.now() - startTime;
      this.logger.log(
        `✅ Validation completed in ${validationTime}ms - Score: ${result.securityScore}/100`,
      );

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Validation failed:`, message);
      result.isValid = false;
      result.errors.push(`Erreur de validation: ${message}`);
      return result;
    }
  }

  /**
   * Validation en lot
   */
  async validateMultipleFiles(
    files: Express.Multer.File[],
    uploadType: UploadType,
    customOptions?: ValidationOptions,
  ): Promise<{
    valid: Array<{ file: Express.Multer.File; result: ValidationResult }>;
    invalid: Array<{ file: Express.Multer.File; result: ValidationResult }>;
  }> {
    this.logger.log(`🔍 Validating ${files.length} files`);

    const valid: Array<{
      file: Express.Multer.File;
      result: ValidationResult;
    }> = [];
    const invalid: Array<{
      file: Express.Multer.File;
      result: ValidationResult;
    }> = [];

    // Traitement en parallèle avec limitation
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (file) => {
          const result = await this.validateFile(
            file,
            uploadType,
            customOptions,
          );
          return { file, result };
        }),
      );

      results.forEach((promiseResult) => {
        if (promiseResult.status === 'fulfilled') {
          const { file, result } = promiseResult.value;
          if (result.isValid) {
            valid.push({ file, result });
          } else {
            invalid.push({ file, result });
          }
        }
      });
    }

    this.logger.log(
      `✅ Batch validation completed: ${valid.length} valid, ${invalid.length} invalid`,
    );

    return { valid, invalid };
  }

  /**
   * Valide la taille du fichier
   */
  private async validateSize(
    file: Express.Multer.File,
    config: any,
    result: ValidationResult,
  ): Promise<void> {
    if (config.maxSize && file.size > config.maxSize) {
      result.errors.push(
        `Fichier trop volumineux: ${this.formatBytes(
          file.size,
        )} > ${this.formatBytes(config.maxSize)}`,
      );
      result.securityScore -= 20;
    }

    if (config.minSize && file.size < config.minSize) {
      result.errors.push(
        `Fichier trop petit: ${this.formatBytes(
          file.size,
        )} < ${this.formatBytes(config.minSize)}`,
      );
      result.securityScore -= 10;
    }

    // Détection de fichier vide
    if (file.size === 0) {
      result.errors.push('Fichier vide détecté');
      result.securityScore -= 30;
    }
  }

  /**
   * Valide le type MIME
   */
  private async validateMimeType(
    file: Express.Multer.File,
    config: any,
    result: ValidationResult,
  ): Promise<void> {
    if (!config.allowedMimeTypes || config.allowedMimeTypes.includes('*')) {
      return;
    }

    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      result.errors.push(
        `Type MIME non autorisé: ${file.mimetype}. Autorisés: ${config.allowedMimeTypes.join(', ')}`,
      );
      result.securityScore -= 25;
    }
  }

  /**
   * Valide l'extension du fichier
   */
  private async validateExtension(
    file: Express.Multer.File,
    config: any,
    result: ValidationResult,
  ): Promise<void> {
    if (!config.allowedExtensions || config.allowedExtensions.includes('*')) {
      return;
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!config.allowedExtensions.includes(fileExtension)) {
      result.errors.push(
        `Extension non autorisée: ${fileExtension}. Autorisées: ${config.allowedExtensions.join(', ')}`,
      );
      result.securityScore -= 25;
    }
  }

  /**
   * Valide la signature du fichier
   */
  private async validateFileSignature(
    file: Express.Multer.File,
    result: ValidationResult,
  ): Promise<void> {
    try {
      // Détection du type réel
      const detectedType = await fileTypeFromBuffer(file.buffer);

      if (detectedType) {
        result.detectedType = {
          ext: detectedType.ext,
          mime: detectedType.mime,
        };

        // Vérification de cohérence
        const declaredExtension = path
          .extname(file.originalname)
          .slice(1)
          .toLowerCase();
        if (detectedType.ext !== declaredExtension) {
          result.warnings.push(
            `Incohérence d'extension: déclarée "${declaredExtension}", détectée "${detectedType.ext}"`,
          );
          result.securityScore -= 15;
        }

        if (detectedType.mime !== file.mimetype) {
          result.warnings.push(
            `Incohérence MIME: déclaré "${file.mimetype}", détecté "${detectedType.mime}"`,
          );
          result.securityScore -= 15;
        }
      } else {
        result.warnings.push('Type de fichier non détectable par signature');
        result.securityScore -= 5;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.warnings.push(`Erreur d'analyse de signature: ${message}`);
    }
  }

  /**
   * Analyse de sécurité approfondie
   */
  private async performSecurityAnalysis(
    file: Express.Multer.File,
    result: ValidationResult,
  ): Promise<void> {
    // Vérification des signatures dangereuses
    for (const danger of this.dangerousSignatures) {
      if (this.hasSignature(file.buffer, danger.signature)) {
        result.errors.push(`Signature dangereuse détectée: ${danger.name}`);
        result.securityScore -= 50;
      }
    }

    // Analyse du nom de fichier
    if (this.hasSuspiciousFileName(file.originalname)) {
      result.warnings.push('Nom de fichier suspect détecté');
      result.securityScore -= 10;
    }

    // Vérification de la complexité excessive
    if (file.buffer.length > 0) {
      const entropy = this.calculateEntropy(file.buffer.slice(0, 1024));
      if (entropy > 7.5) {
        result.warnings.push('Entropie élevée détectée (possible chiffrement)');
        result.securityScore -= 5;
      }
    }
  }

  /**
   * Exécute les validateurs personnalisés
   */
  private async runCustomValidators(
    file: Express.Multer.File,
    validators: Array<(file: Express.Multer.File) => Promise<boolean>>,
    result: ValidationResult,
  ): Promise<void> {
    for (const validator of validators) {
      try {
        const isValid = await validator(file);
        if (!isValid) {
          result.errors.push('Échec de validation personnalisée');
          result.securityScore -= 10;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result.warnings.push(`Erreur dans validateur personnalisé: ${message}`);
      }
    }
  }

  /**
   * Calcule le score final
   */
  private calculateFinalScore(result: ValidationResult): void {
    result.isValid = result.errors.length === 0 && result.securityScore >= 50;

    if (result.securityScore < 0) {
      result.securityScore = 0;
    }
  }

  /**
   * Vérifie la présence d'une signature
   */
  private hasSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) return false;

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Détecte les noms de fichiers suspects
   */
  private hasSuspiciousFileName(fileName: string): boolean {
    const suspicious = [
      /\.(exe|bat|cmd|scr|pif|com)$/i,
      /\.(vbs|js|jar|sh)$/i,
      /\.(php|asp|jsp)$/i,
      /\.(dll|sys|msi)$/i,
    ];

    return suspicious.some((pattern) => pattern.test(fileName));
  }

  /**
   * Calcule l'entropie d'un buffer
   */
  private calculateEntropy(buffer: Buffer): number {
    const frequency: { [key: number]: number } = {};

    for (const byte of buffer) {
      frequency[byte] = (frequency[byte] || 0) + 1;
    }

    let entropy = 0;
    const length = buffer.length;

    for (const count of Object.values(frequency)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Formate les bytes en format lisible
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Génère un hash sécurisé du fichier
   */
  generateFileHash(file: Express.Multer.File): string {
    return crypto.createHash('sha256').update(file.buffer).digest('hex');
  }

  /**
   * Vérifie si un fichier est potentiellement malveillant
   */
  async isSuspiciousFile(file: Express.Multer.File): Promise<boolean> {
    const result = await this.validateFile(file, UploadType.ATTACHMENT, {
      requireSignatureCheck: true,
    });

    return result.securityScore < 70 || result.errors.length > 0;
  }
}
