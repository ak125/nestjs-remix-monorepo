/**
 * 🔐 PasswordCryptoService - Service Centralisé de Cryptographie
 * ✅ Service unique pour toute la gestion de mot de passe
 * ✅ Support multi-format : bcrypt, MD5, MD5+crypt legacy
 * ✅ Validation de force de mot de passe
 * ✅ Aucune dépendance externe (injectable partout)
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import crypt = require('unix-crypt-td-js');

/** Anciens formats d'empreinte, tous faibles (calcul rapide, sel fixe ou absent). */
export type LegacyHashFormat = 'md5' | 'sha1' | 'md5-crypt';

export interface PasswordValidationResult {
  isValid: boolean;
  format:
    | 'bcrypt'
    | 'wrapped'
    | 'md5'
    | 'md5-crypt'
    | 'sha1'
    | 'plain'
    | 'unknown';
  /** Pour `wrapped` : l'ancien calcul enveloppé. */
  legacyFormat?: LegacyHashFormat;
}

/**
 * Empreinte « enveloppée » : bcrypt appliqué à une ancienne empreinte.
 *
 *   $akwrap$v1$<format>$<bcrypt(ancienne_empreinte)>
 *
 * Le préfixe ne commence pas par `$2` (bcrypt) et contient des `$`, absents des
 * empreintes hex (md5, sha1) et de l'alphabet DES (`[./0-9A-Za-z]`) : aucun
 * format existant ne peut être lu comme une enveloppe, ni l'inverse.
 * Validation : bcrypt.compare(ancien_calcul(mot_de_passe), partie bcrypt).
 */
export const WRAPPED_HASH_PREFIX = '$akwrap$v1$';
const WRAPPED_HASH_RE =
  /^\$akwrap\$v1\$(md5|sha1|md5-crypt)\$(\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53})$/;

@Injectable()
export class PasswordCryptoService {
  private readonly logger = new Logger(PasswordCryptoService.name);
  private readonly BCRYPT_ROUNDS = 10; // ✅ Compromis sécurité/performance (100ms vs 400ms)
  private readonly LEGACY_SALT = 'im10tech7';

  constructor() {
    this.logger.log(
      'PasswordCryptoService initialized - Centralized crypto service',
    );
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
      // Format bcrypt moderne ($2a$, $2b$, $2y$)
      if (hashedPassword.startsWith('$2')) {
        this.logger.debug('🔐 Using bcrypt validation');
        const isValid = await bcrypt.compare(plainPassword, hashedPassword);
        this.logger.debug(`🔐 Bcrypt result: ${isValid}`);
        return { isValid, format: 'bcrypt' };
      }

      // Ancienne empreinte enveloppée dans bcrypt. Ne retombe jamais sur les
      // branches suivantes (texte en clair compris) : une enveloppe mal formée
      // est refusée.
      if (this.isWrappedHash(hashedPassword)) {
        const parsed = this.parseWrappedHash(hashedPassword);
        if (!parsed) {
          this.logger.warn('Malformed wrapped password hash');
          return { isValid: false, format: 'wrapped' };
        }
        const legacyDigest = this.computeLegacyDigest(
          parsed.legacyFormat,
          plainPassword,
        );
        const isValid = await bcrypt.compare(legacyDigest, parsed.inner);
        return {
          isValid,
          format: 'wrapped',
          legacyFormat: parsed.legacyFormat,
        };
      }

      // Format MD5 simple (32 caractères hex) - utilisé dans ___config_admin
      if (
        hashedPassword.length === 32 &&
        /^[a-f0-9]{32}$/i.test(hashedPassword)
      ) {
        const md5Hash = this.computeLegacyDigest('md5', plainPassword);
        const isValid = this.secureCompare(md5Hash, hashedPassword);
        return { isValid, format: 'md5' };
      }

      // Format SHA1 (40 caractères hex) - système intermédiaire
      if (
        hashedPassword.length === 40 &&
        /^[a-f0-9]{40}$/i.test(hashedPassword)
      ) {
        const sha1Hash = this.computeLegacyDigest('sha1', plainPassword);
        const isValid = this.secureCompare(sha1Hash, hashedPassword);
        return { isValid, format: 'sha1' };
      }

      // Format legacy MD5+crypt avec sel "im10tech7" (13 caractères)
      if (hashedPassword.length === 13) {
        const isValid = this.verifyLegacyPassword(
          plainPassword,
          hashedPassword,
        );
        return { isValid, format: 'md5-crypt' };
      }

      // Plain text (très ancien système - à éviter)
      if (plainPassword === hashedPassword) {
        this.logger.warn('Plain text password detected - should be upgraded');
        return { isValid: true, format: 'plain' };
      }

      // Format inconnu
      this.logger.warn(
        `Unknown password format: length=${hashedPassword.length}`,
      );
      return { isValid: false, format: 'unknown' };
    } catch (error) {
      this.logger.error('Error validating password:', error);
      return { isValid: false, format: 'unknown' };
    }
  }

  /**
   * Format d'une ancienne empreinte, selon les mêmes règles que validatePassword.
   * `null` pour bcrypt, une enveloppe, une valeur vide ou un format inconnu.
   */
  detectLegacyFormat(hash: string | null | undefined): LegacyHashFormat | null {
    if (!hash || hash.startsWith('$')) return null;
    if (/^[a-f0-9]{32}$/i.test(hash)) return 'md5';
    if (/^[a-f0-9]{40}$/i.test(hash)) return 'sha1';
    if (hash.length === 13) return 'md5-crypt';
    return null;
  }

  /**
   * SEUL point de calcul des anciennes empreintes faibles (md5, sha1,
   * crypt(md5) à sel fixe). Volontaire (mandat AP, décisions 88 et 89) : il ne
   * sert qu'à VÉRIFIER un mot de passe contre une empreinte existante, nue ou
   * enveloppée dans bcrypt (`$akwrap$v1$`). Aucune nouvelle empreinte n'est
   * stockée sous ces formats : après connexion, le compte passe en bcrypt
   * simple (`upgradeHashIfNeeded`). À retirer avec le sel fixe quand il ne
   * reste plus d'ancienne empreinte en base (voir PR #2100).
   */
  computeLegacyDigest(format: LegacyHashFormat, plainPassword: string): string {
    if (format === 'sha1') {
      return crypto.createHash('sha1').update(plainPassword).digest('hex');
    }
    const md5Hex = crypto.createHash('md5').update(plainPassword).digest('hex');
    return format === 'md5' ? md5Hex : this.phpCrypt(md5Hex, this.LEGACY_SALT);
  }

  /**
   * Envelopper une ancienne empreinte dans bcrypt, sans connaître le mot de
   * passe. Refuse tout ce qui n'est pas une ancienne empreinte reconnue.
   */
  async wrapLegacyHash(legacyHash: string): Promise<string> {
    const format = this.detectLegacyFormat(legacyHash);
    if (!format) {
      throw new Error('wrapLegacyHash: not a recognised legacy hash');
    }
    const inner = await bcrypt.hash(legacyHash, this.BCRYPT_ROUNDS);
    return `${WRAPPED_HASH_PREFIX}${format}$${inner}`;
  }

  /**
   * Vérifier qu'une enveloppe correspond exactement à l'ancienne empreinte
   * (même format déclaré, même valeur), avant de remplacer l'une par l'autre.
   */
  async wrappedMatchesLegacy(
    wrapped: string,
    legacyHash: string,
  ): Promise<boolean> {
    const parsed = this.parseWrappedHash(wrapped);
    if (!parsed) return false;
    if (parsed.legacyFormat !== this.detectLegacyFormat(legacyHash)) {
      return false;
    }
    return bcrypt.compare(legacyHash, parsed.inner);
  }

  isWrappedHash(hash: string): boolean {
    return hash.startsWith(WRAPPED_HASH_PREFIX);
  }

  private parseWrappedHash(
    hash: string,
  ): { legacyFormat: LegacyHashFormat; inner: string } | null {
    const m = WRAPPED_HASH_RE.exec(hash);
    if (!m) return null;
    return { legacyFormat: m[1] as LegacyHashFormat, inner: m[2] };
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
      const legacyHash = this.computeLegacyDigest('md5-crypt', plainPassword);
      return legacyHash === hashedPassword;
    } catch (error) {
      this.logger.error('Error verifying legacy password:', error);
      return false;
    }
  }

  /**
   * Fonction crypt() compatible PHP (DES encryption)
   * ✅ Utilise unix-crypt-td-js pour la compatibilité exacte avec PHP
   */
  private phpCrypt(password: string, salt: string): string {
    try {
      // Utiliser la vraie fonction crypt() de PHP (DES encryption)
      return crypt(password, salt);
    } catch (error) {
      this.logger.error('Error in phpCrypt:', error);
      throw error;
    }
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
      this.logger.error(
        `Failed to upgrade password for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Valider la force d'un mot de passe
   * ✅ Minimum 6 caractères
   */
  validatePasswordStrength(password: string): void {
    if (password.length < 6) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 6 caractères',
      );
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
