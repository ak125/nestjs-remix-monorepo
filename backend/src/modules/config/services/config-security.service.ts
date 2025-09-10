import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ConfigSecurityService {
  private readonly logger = new Logger(ConfigSecurityService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;

  encrypt(text: string, encryptionKey?: string): string {
    try {
      const key = this.getOrGenerateKey(encryptionKey);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, key);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Erreur lors du chiffrement', error);
      throw new Error('Erreur de chiffrement');
    }
  }

  decrypt(encryptedData: string, encryptionKey?: string): string {
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      const key = this.getOrGenerateKey(encryptionKey);
      const decipher = crypto.createDecipher(this.algorithm, key);
      
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
      return crypto.createHash('sha256').update(providedKey).digest('hex').slice(0, this.keyLength);
    }
    
    const envKey = process.env.CONFIG_ENCRYPTION_KEY;
    if (envKey) {
      return crypto.createHash('sha256').update(envKey).digest('hex').slice(0, this.keyLength);
    }
    
    // Fallback key - should not be used in production
    this.logger.warn('Utilisation d\'une clé de chiffrement par défaut - non recommandé en production');
    return crypto.createHash('sha256').update('default-key-change-in-production').digest('hex').slice(0, this.keyLength);
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

    return sensitivePatterns.some(pattern => pattern.test(key));
  }
}
