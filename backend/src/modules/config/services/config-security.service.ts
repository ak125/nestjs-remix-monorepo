import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ConfigSecurityService {
  private readonly logger = new Logger(ConfigSecurityService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;

  encrypt(text: string, encryptionKey?: string): string {
    try {
      const key = Buffer.from(this.getOrGenerateKey(encryptionKey), 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', key);
      cipher.setAAD(iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encryptedData
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Erreur lors du chiffrement', error);
      throw new Error('Erreur de chiffrement');
    }
  }

  decrypt(encryptedData: string, encryptionKey?: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Format de données chiffrées invalide');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const key = Buffer.from(this.getOrGenerateKey(encryptionKey), 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAAD(iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Erreur lors du déchiffrement', error);
      throw new Error('Erreur de déchiffrement');
    }
  }

  private getOrGenerateKey(providedKey?: string): string {
    if (providedKey) {
      return crypto
        .createHash('sha256')
        .update(providedKey)
        .digest('hex')
        .slice(0, this.keyLength);
    }

    const envKey = process.env.CONFIG_ENCRYPTION_KEY;
    if (envKey) {
      return crypto
        .createHash('sha256')
        .update(envKey)
        .digest('hex')
        .slice(0, this.keyLength);
    }

    // Fallback key - should not be used in production
    this.logger.warn(
      "Utilisation d'une clé de chiffrement par défaut - non recommandé en production",
    );
    return crypto
      .createHash('sha256')
      .update('default-key-change-in-production')
      .digest('hex')
      .slice(0, this.keyLength);
  }

  isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i,
      /auth/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(key));
  }
}
