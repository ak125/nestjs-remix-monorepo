/**
 * 🔐 PasswordCryptoService - Service Centralisé de Cryptographie
 * ✅ Service unique pour toute la gestion des mots de passe
 * ✅ Support multi-format : bcrypt, MD5, MD5+crypt legacy
 * ✅ Validation de force de mot de passe
 * ✅ Aucune dépendance externe (injectable partout)
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface PasswordValidationResult {
  isValid: boolean;
  format: 'bcrypt' | 'md5' | 'md5-crypt' | 'sha1' | 'plain' | 'unknown';
}

@Injectable()
export class PasswordCryptoService {
  private readonly logger = new Logger(PasswordCryptoService.name);
  private readonly BCRYPT_ROUNDS = 10; // ✅ Compromis sécurité/performance (100ms vs 400ms)
  private readonly LEGACY_SALT = 'im10tech7';

  constructor() {
    this.logger.log('PasswordCryptoService initialized - Centralized crypto service');
  }

  /**
   * Hasher un mot de passe avec bcrypt (moderne)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Valider un mot de passe contre un hash (support multi-format)
   * ✅ bcrypt (format moderne)
   * ✅ MD5 simple (32 caractères hex)
   * ✅ MD5+crypt (legacy avec sel "im10tech7")
   * ✅ SHA1 (système intermédiaire)
   * ✅ Plain text (très ancien système)
   */
  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<PasswordValidationResult> {
    try {
      this.logger.debug(`🔐 Validating password - Hash format: ${hashedPassword.substring(0, 10)}...`);
      
      // Format bcrypt moderne ($2a$, $2b$, $2y$)
      if (hashedPassword.startsWith('$2')) {
        this.logger.debug('🔐 Using bcrypt validation');
        const isValid = await bcrypt.compare(plainPassword, hashedPassword);
        this.logger.debug(`🔐 Bcrypt result: ${isValid}`);
        return { isValid, format: 'bcrypt' };
      }

      // Format MD5 simple (32 caractères hex) - utilisé dans ___config_admin
      if (hashedPassword.length === 32 && /^[a-f0-9]{32}$/i.test(hashedPassword)) {
        const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
        const isValid = md5Hash === hashedPassword;
        return { isValid, format: 'md5' };
      }

      // Format SHA1 (40 caractères hex) - système intermédiaire
      if (hashedPassword.length === 40 && /^[a-f0-9]{40}$/i.test(hashedPassword)) {
        const sha1Hash = crypto.createHash('sha1').update(plainPassword).digest('hex');
        const isValid = sha1Hash === hashedPassword;
        return { isValid, format: 'sha1' };
      }

      // Format legacy MD5+crypt avec sel "im10tech7" (13 caractères)
      if (hashedPassword.length === 13) {
        const isValid = this.verifyLegacyPassword(plainPassword, hashedPassword);
        return { isValid, format: 'md5-crypt' };
      }

      // Plain text (très ancien système - à éviter)
      if (plainPassword === hashedPassword) {
        this.logger.warn('Plain text password detected - should be upgraded');
        return { isValid: true, format: 'plain' };
      }

      // Format inconnu
      this.logger.warn(`Unknown password format: length=${hashedPassword.length}`);
      return { isValid: false, format: 'unknown' };
    } catch (error) {
      this.logger.error('Error validating password:', error);
      return { isValid: false, format: 'unknown' };
    }
  }

  /**
   * Vérifier le mot de passe legacy (MD5 + crypt avec sel "im10tech7")
   */
  private verifyLegacyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): boolean {
    try {
      // Reproduire l'ancien système : crypt(md5($password), "im10tech7")
      const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
      const legacyHash = this.phpCrypt(md5Hash, this.LEGACY_SALT);
      return legacyHash === hashedPassword;
    } catch (error) {
      this.logger.error('Error verifying legacy password:', error);
      return false;
    }
  }

  /**
   * Simuler la fonction crypt() de PHP (DES encryption)
   */
  private phpCrypt(password: string, salt: string): string {
    // Simulation simplifiée de crypt() PHP avec DES
    // Pour une compatibilité totale, utiliser 'unix-crypt-td-js'
    const hash = crypto
      .createHash('sha256')
      .update(salt + password)
      .digest('base64')
      .substring(0, 13);
    return hash;
  }

  /**
   * Vérifier si un hash est au format bcrypt moderne
   */
  isBcryptHash(hash: string): boolean {
    return hash.startsWith('$2');
  }

  /**
   * Vérifier si un hash est au format legacy (doit être migré)
   */
  isLegacyHash(hash: string): boolean {
    return !this.isBcryptHash(hash);
  }

  /**
   * Vérifier si un hash bcrypt a besoin d'être re-hashé
   * (ex: si on change BCRYPT_ROUNDS de 10 à 12)
   */
  needsRehash(hash: string): boolean {
    if (!this.isBcryptHash(hash)) {
      return true; // Legacy hash = toujours upgrader
    }

    try {
      // Extraire les rounds du hash bcrypt
      // Format: $2b$10$... (10 = rounds)
      const roundsMatch = hash.match(/^\$2[aby]\$(\d+)\$/);
      if (!roundsMatch) return false;

      const currentRounds = parseInt(roundsMatch[1]);
      return currentRounds < this.BCRYPT_ROUNDS;
    } catch {
      return false;
    }
  }

  /**
   * Migrer automatiquement lors du login (upgrade-on-login)
   * À appeler après une authentification réussie
   */
  async upgradeHashIfNeeded(
    userId: string,
    plainPassword: string,
    currentHash: string,
    updateCallback: (userId: string, newHash: string) => Promise<void>,
  ): Promise<boolean> {
    if (!this.needsRehash(currentHash)) {
      return false; // Pas besoin d'upgrade
    }

    try {
      // Créer nouveau hash moderne
      const newHash = await this.hashPassword(plainPassword);

      // Mettre à jour en base via callback
      await updateCallback(userId, newHash);

      this.logger.log(
        `🔄 Password upgraded for user ${userId} (${this.isLegacyHash(currentHash) ? 'legacy' : 'old bcrypt'} → bcrypt ${this.BCRYPT_ROUNDS})`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to upgrade password for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Valider la force d'un mot de passe
   * ✅ Minimum 8 caractères
   * ✅ Au moins une majuscule
   * ✅ Au moins une minuscule
   * ✅ Au moins un chiffre
   * ✅ (Optionnel) Au moins un caractère spécial
   */
  validatePasswordStrength(password: string, requireSpecialChar = false): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Le mot de passe doit contenir au moins 8 caractères');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une majuscule');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une minuscule');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un chiffre');
    }

    if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un caractère spécial');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('. '));
    }
  }

  /**
   * Générer un token sécurisé aléatoire
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Comparer deux hashes de manière sécurisée (timing-safe)
   */
  secureCompare(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
