import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

/**
 * Utilitaires pour la validation avec Zod
 */
export class ValidationUtils {
  /**
   * Valide des données avec un schéma Zod
   * @param schema Schéma Zod pour la validation
   * @param data Données à valider
   * @returns Données validées et transformées
   * @throws BadRequestException si validation échoue
   */
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        throw new BadRequestException({
          message: 'Erreur de validation',
          errors: errorMessages,
          statusCode: 400,
        });
      }

      throw error;
    }
  }

  /**
   * Validation avec retour de résultat au lieu d'exception
   * @param schema Schéma Zod
   * @param data Données à valider
   * @returns Objet avec success et data ou error
   */
  static safeParse<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
  ): {
    success: boolean;
    data?: T;
    error?: z.ZodError;
  } {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  }

  /**
   * Valider et nettoyer les métadonnées JSON
   * @param metadata Métadonnées à valider
   * @returns Métadonnées nettoyées
   */
  static validateMetadata(metadata: unknown): Record<string, any> | undefined {
    if (!metadata) return undefined;

    try {
      // Si c'est déjà un objet, on le retourne
      if (typeof metadata === 'object' && metadata !== null) {
        return metadata as Record<string, any>;
      }

      // Si c'est une string, on essaie de la parser
      if (typeof metadata === 'string') {
        return JSON.parse(metadata);
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Valider un montant monétaire
   * @param amount Montant à valider
   * @param currency Devise (optionnel)
   * @returns true si valide
   */
  static validateAmount(amount: number, currency = 'EUR'): boolean {
    // Montant positif
    if (amount <= 0) return false;

    // Maximum raisonnable (100k EUR par défaut)
    const maxAmount = currency === 'EUR' ? 100000 : 100000;
    if (amount > maxAmount) return false;

    // Vérifier le nombre de décimales (max 2 pour la plupart des devises)
    const decimals = (amount.toString().split('.')[1] || '').length;
    if (decimals > 2) return false;

    return true;
  }

  /**
   * Normaliser un numéro de téléphone français
   * @param phone Numéro de téléphone
   * @returns Numéro normalisé ou null si invalide
   */
  static normalizePhone(phone?: string): string | null {
    if (!phone) return null;

    // Supprimer tous les espaces, tirets, points
    const cleaned = phone.replace(/[\s\-\.]/g, '');

    // Schéma de validation pour téléphone français
    const phoneRegex = /^(?:\+33|0)[1-9](?:[0-9]{8})$/;

    if (phoneRegex.test(cleaned)) {
      // Convertir en format international
      if (cleaned.startsWith('0')) {
        return '+33' + cleaned.substring(1);
      }
      return cleaned;
    }

    return null;
  }

  /**
   * Valider et formater un email
   * @param email Email à valider
   * @returns Email formaté ou null si invalide
   */
  static validateEmail(email?: string): string | null {
    if (!email) return null;

    const emailSchema = z.string().email();
    const result = emailSchema.safeParse(email.toLowerCase().trim());

    return result.success ? result.data : null;
  }

  /**
   * Valider un code postal français
   * @param postalCode Code postal
   * @returns true si valide
   */
  static validateFrenchPostalCode(postalCode: string): boolean {
    const postalCodeRegex = /^[0-9]{5}$/;
    return postalCodeRegex.test(postalCode);
  }

  /**
   * Nettoyer et valider une URL
   * @param url URL à valider
   * @returns URL nettoyée ou null si invalide
   */
  static validateUrl(url?: string): string | null {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      // Seuls HTTP et HTTPS autorisés
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return null;
      }
      return urlObj.toString();
    } catch {
      return null;
    }
  }

  /**
   * Générer un ID de paiement unique
   * @returns ID de paiement
   */
  static generatePaymentId(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `pay_${timestamp}_${random}`;
  }

  /**
   * Générer un ID de transaction unique
   * @returns ID de transaction
   */
  static generateTransactionId(): string {
    // Format: YYYYMMDDHHMMSS + 6 chiffres aléatoires
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:T]/g, '')
      .replace(/\.\d{3}Z$/, '')
      .substring(0, 14);

    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');

    return `${timestamp}${random}`;
  }

  /**
   * Générer un ID de commande unique pour ___xtr_order
   * @returns ID de commande (format: timestamp + random pour être unique)
   */
  static generateOrderId(): string {
    // Format inspiré des IDs existants: 6 chiffres basé sur timestamp
    const now = Date.now();
    const random = Math.floor(Math.random() * 1000);
    // Garder les 6 derniers chiffres du timestamp + 3 random
    const orderId = Math.floor((now % 1000000) + random * 1000000);
    return orderId.toString();
  }

  /**
   * Formater un montant pour affichage
   * @param amount Montant
   * @param currency Devise
   * @returns Montant formaté
   */
  static formatAmount(amount: number, currency = 'EUR'): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Convertir un montant en centimes (pour les gateways)
   * @param amount Montant en euros
   * @returns Montant en centimes
   */
  static amountToCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Convertir des centimes en montant
   * @param cents Montant en centimes
   * @returns Montant en euros
   */
  static centsToAmount(cents: number): number {
    return cents / 100;
  }
}
