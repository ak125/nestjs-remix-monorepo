import { Injectable, Logger } from '@nestjs/common';
import { CatalogDataIntegrityService } from '../../catalog/services/catalog-data-integrity.service';

/**
 * 🛡️ SERVICE DE VALIDATION DES URLs VÉHICULE-PIÈCES POUR LE SITEMAP
 *
 * Valide les combinaisons type_id + gamme_id AVANT l'ajout au sitemap XML
 * pour éviter d'indexer des URLs qui retourneront 404/410 Gone
 *
 * Critères de validation :
 * - ✅ type_id existe dans auto_type
 * - ✅ gamme_id existe dans pieces_gamme
 * - ✅ Au moins 1 pièce disponible
 * - ✅ Au moins 50% des pièces ont une marque (qualité minimum)
 *
 * Utilisé par SitemapService pour filtrer les URLs avant génération du XML
 */
@Injectable()
export class SitemapVehiclePiecesValidator {
  private readonly logger = new Logger(SitemapVehiclePiecesValidator.name);

  constructor(private readonly integrityService: CatalogDataIntegrityService) {}

  /**
   * 🔍 Valide une URL de pièce-véhicule AVANT ajout au sitemap
   *
   * @param typeId - ID du type de véhicule (ex: 14820 pour Mercedes Classe C 220 CDI)
   * @param gammeId - ID de la gamme de pièces (ex: 854 pour amortisseurs)
   * @returns Objet indiquant si l'URL est valide pour le sitemap
   *
   * @example
   * ```typescript
   * const result = await validator.validateUrl(18784, 854);
   * // { isValid: false, httpStatus: 404, reason: "Type ID inexistant" }
   *
   * const result = await validator.validateUrl(14820, 854);
   * // { isValid: true, httpStatus: 200, reason: "200 OK - Données valides" }
   * ```
   */
  async validateUrl(
    typeId: number,
    gammeId: number,
  ): Promise<{
    isValid: boolean;
    httpStatus: number;
    reason: string;
    relationsCount?: number;
    brandPercent?: number;
  }> {
    try {
      // Utiliser le service d'intégrité existant pour validation complète
      const validation =
        await this.integrityService.validateTypeGammeCompatibility(
          typeId,
          gammeId,
        );

      // Critères d'exclusion du sitemap :
      // 1. type_id n'existe pas → 404 Not Found
      // 2. gamme_id n'existe pas → 404 Not Found
      // 3. 0 pièces disponibles → 410 Gone
      // 4. < 50% des pièces avec marque → 410 Gone (données de mauvaise qualité)

      if (!validation.valid) {
        this.logger.warn(
          `🚫 URL EXCLUE du sitemap: type_id=${typeId}, gamme_id=${gammeId}, status=${validation.http_status}, raison=${validation.recommendation}`,
        );

        return {
          isValid: false,
          httpStatus: validation.http_status,
          reason: validation.recommendation,
          relationsCount: validation.relations_count,
          brandPercent: validation.data_quality?.pieces_with_brand_percent || 0,
        };
      }

      // Si < 80% avec marque → warning mais accepter quand même dans sitemap
      if (validation.data_quality.pieces_with_brand_percent < 80) {
        this.logger.warn(
          `⚠️ URL acceptée mais qualité moyenne: type_id=${typeId}, gamme_id=${gammeId}, brand_percent=${validation.data_quality.pieces_with_brand_percent}%`,
        );
      }

      this.logger.debug(
        `✅ URL VALIDE pour sitemap: type_id=${typeId}, gamme_id=${gammeId}, ${validation.relations_count} pièces, ${validation.data_quality.pieces_with_brand_percent}% avec marque`,
      );

      return {
        isValid: true,
        httpStatus: 200,
        reason: validation.recommendation,
        relationsCount: validation.relations_count,
        brandPercent: validation.data_quality.pieces_with_brand_percent,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur validation URL type_id=${typeId}, gamme_id=${gammeId}:`,
        error,
      );

      // En cas d'erreur, exclure par sécurité
      return {
        isValid: false,
        httpStatus: 500,
        reason: 'Erreur de validation - URL exclue par sécurité',
      };
    }
  }

  /**
   * 🔄 Filtre un lot d'URLs pour le sitemap
   * Retourne uniquement les URLs valides (200 OK)
   *
   * @param urls - Tableau d'URLs candidates avec leurs metadata
   * @returns Tableau d'URLs valides prêtes pour le sitemap XML
   *
   * @example
   * ```typescript
   * const candidates = [
   *   { typeId: 18784, gammeId: 854, url: '/pieces/amortisseur-1/.../220-cdi-18784.html' },
   *   { typeId: 14820, gammeId: 854, url: '/pieces/amortisseur-1/.../220-cdi-14820.html' }
   * ];
   *
   * const valid = await validator.filterUrlsForSitemap(candidates);
   * // Retourne seulement la 2e URL (14820 est valide, 18784 est invalide)
   * ```
   */
  async filterUrlsForSitemap(
    urls: Array<{
      typeId: number;
      gammeId: number;
      url: string;
      marqueAlias?: string;
      modeleAlias?: string;
      typeAlias?: string;
    }>,
  ): Promise<
    Array<{
      url: string;
      lastmod: string;
      priority: number;
      changefreq: string;
      metadata?: {
        typeId: number;
        gammeId: number;
        relationsCount: number;
        brandPercent: number;
      };
    }>
  > {
    const validUrls = [];
    let validCount = 0;
    let invalidCount = 0;

    this.logger.log(
      `🔍 Début filtrage sitemap: ${urls.length} URLs candidates...`,
    );

    // Traiter par batch de 50 pour éviter de surcharger la DB
    const batchSize = 50;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      // Valider toutes les URLs du batch en parallèle
      const validations = await Promise.all(
        batch.map((item) => this.validateUrl(item.typeId, item.gammeId)),
      );

      // Filtrer les URLs valides
      batch.forEach((item, index) => {
        const validation = validations[index];

        if (validation.isValid) {
          validUrls.push({
            url: item.url,
            lastmod: new Date().toISOString(),
            priority: 0.7, // Priorité moyenne pour les pages produits
            changefreq: 'weekly' as const,
            metadata: {
              typeId: item.typeId,
              gammeId: item.gammeId,
              relationsCount: validation.relationsCount || 0,
              brandPercent: validation.brandPercent || 0,
            },
          });
          validCount++;
        } else {
          invalidCount++;
        }
      });

      // Log de progression
      if ((i + batchSize) % 500 === 0) {
        this.logger.log(
          `📊 Progression: ${i + batchSize}/${urls.length} URLs traitées (${validCount} valides, ${invalidCount} invalides)`,
        );
      }
    }

    this.logger.log(
      `✅ Filtrage sitemap terminé: ${validCount}/${urls.length} URLs valides (${invalidCount} exclues, ${((invalidCount / urls.length) * 100).toFixed(1)}% de taux d'exclusion)`,
    );

    return validUrls;
  }

  /**
   * 📊 Génère un rapport de qualité des URLs
   * Utile pour analyser les raisons d'exclusion
   *
   * @param urls - URLs à analyser
   * @returns Rapport détaillé avec statistiques
   */
  async generateQualityReport(
    urls: Array<{ typeId: number; gammeId: number; url: string }>,
  ): Promise<{
    total: number;
    valid: number;
    invalid: number;
    invalidReasons: Array<{
      reason: string;
      count: number;
      examples: string[];
    }>;
  }> {
    const invalidReasons = new Map<
      string,
      { count: number; examples: string[] }
    >();
    let validCount = 0;

    for (const item of urls.slice(0, 1000)) {
      // Limiter à 1000 pour le rapport
      const validation = await this.validateUrl(item.typeId, item.gammeId);

      if (validation.isValid) {
        validCount++;
      } else {
        const reason = validation.reason;
        const existing = invalidReasons.get(reason) || {
          count: 0,
          examples: [],
        };
        existing.count++;
        if (existing.examples.length < 5) {
          existing.examples.push(item.url);
        }
        invalidReasons.set(reason, existing);
      }
    }

    const invalidReasonsArray = Array.from(invalidReasons.entries()).map(
      ([reason, data]) => ({
        reason,
        count: data.count,
        examples: data.examples,
      }),
    );

    return {
      total: urls.length,
      valid: validCount,
      invalid: urls.length - validCount,
      invalidReasons: invalidReasonsArray.sort((a, b) => b.count - a.count),
    };
  }
}
