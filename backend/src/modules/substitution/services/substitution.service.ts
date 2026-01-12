import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { IntentExtractorService } from './intent-extractor.service';
import { SubstitutionLoggerService } from './substitution-logger.service';
import {
  ExtractedIntent,
  SubstitutionResult,
  SubstitutionType,
  SubstitutionHttpStatus,
  LockType,
  SubstitutionLock,
  SubstitutionDataResponse,
} from '../types/substitution.types';

/**
 * SubstitutionService - Moteur de Substitution Sémantique
 *
 * Point d'entrée principal du système "200 Always".
 * Transforme les URLs problématiques en pages de récupération SEO-optimisées.
 *
 * Paradigme:
 * - API retourne toujours HTTP 200
 * - Le vrai code (200/404/410/412) est dans response.httpStatus
 */
@Injectable()
export class SubstitutionService extends SupabaseBaseService {
  protected readonly logger = new Logger(SubstitutionService.name);

  constructor(
    configService: ConfigService,
    private readonly intentExtractor: IntentExtractorService,
    private readonly substitutionLogger: SubstitutionLoggerService,
  ) {
    super(configService);
  }

  /**
   * Point d'entrée principal du Moteur de Substitution
   *
   * @param url - URL à analyser (ex: /pieces/freinage-402.html)
   * @param userAgent - User-Agent pour détection bot
   * @returns SubstitutionResult avec httpStatus, lock, et contenu
   */
  async checkSubstitution(
    url: string,
    userAgent: string = '',
  ): Promise<SubstitutionResult> {
    const startTime = Date.now();

    // 1. Détecter les bots suspects
    if (this.intentExtractor.isSuspiciousBot(userAgent)) {
      this.logger.debug(`Bot suspect bloqué: ${userAgent}`);
      return this.buildResult('unknown_slug', 404, 'Requête bloquée');
    }

    // 2. Extraire l'intention depuis l'URL
    const intent = this.intentExtractor.extractFromPathname(url);
    this.logger.debug(`Intent extracted: ${JSON.stringify(intent)}`);

    // 3. Appeler RPC Supabase pour résoudre la gamme
    const rpcData = await this.fetchSubstitutionData(intent);

    // 4. Déterminer le type de substitution
    const result = this.determineSubstitution(intent, rpcData);

    // 5. Logger async (ne bloque pas la réponse)
    this.substitutionLogger.logAsync({
      original_url: url,
      substitution_type: result.type,
      lock_type: result.lock?.type || null,
      original_intent: intent,
      substitute_content_id: result.substitute?.piece_id?.toString() || null,
      http_status_served: result.httpStatus,
      user_agent: userAgent,
      is_bot: this.isBot(userAgent),
      timestamp: new Date(),
    });

    const duration = Date.now() - startTime;
    this.logger.debug(
      `Substitution resolved in ${duration}ms → ${result.type} (${result.httpStatus})`,
    );

    return result;
  }

  /**
   * Appelle la RPC get_substitution_data
   */
  private async fetchSubstitutionData(
    intent: ExtractedIntent,
  ): Promise<SubstitutionDataResponse> {
    try {
      const { data, error } = await this.supabase.rpc('get_substitution_data', {
        p_gamme_alias: intent.gammeAlias || null,
        p_gamme_id: intent.gammeId || null,
        p_marque_alias: intent.marqueAlias || null,
        p_modele_alias: intent.modeleAlias || null,
        p_type_alias: intent.typeAlias || null,
      });

      if (error) {
        this.logger.error(`RPC error: ${error.message}`);
        return {
          _meta: {
            gamme_found: false,
            resolved_by: 'none',
            products_count: 0,
            vehicle_found: false,
          },
        };
      }

      return data as SubstitutionDataResponse;
    } catch (error) {
      this.logger.error(`RPC exception: ${error.message}`);
      return {
        _meta: {
          gamme_found: false,
          resolved_by: 'none',
          products_count: 0,
          vehicle_found: false,
        },
      };
    }
  }

  /**
   * Logique de décision principale
   * Détermine le type de substitution selon l'intention et les données
   */
  private determineSubstitution(
    intent: ExtractedIntent,
    data: SubstitutionDataResponse,
  ): SubstitutionResult {
    // CASE 1: Gamme non trouvée → 404
    if (!data._meta?.gamme_found) {
      return this.buildResult('unknown_slug', 404, 'Gamme non reconnue', {
        suggestions: this.mapSuggestions(data.suggestions),
        seo: {
          title: 'Page non trouvée | AutoMecanik',
          description:
            "Cette page n'existe pas. Découvrez notre catalogue de pièces automobiles.",
          h1: 'Page non trouvée',
          canonical: '',
        },
      });
    }

    // CASE 2: Gamme trouvée mais 0 produits → 410
    if (data._meta?.products_count === 0) {
      return this.buildResult(
        'gamme_empty',
        410,
        'Cette gamme ne contient plus de produits',
        {
          relatedParts: this.mapRelatedParts(data.related_parts),
          suggestions: this.mapSuggestions(data.suggestions),
          seo: {
            title: `${data.gamme?.pg_name || 'Pièces'} - Temporairement indisponible | AutoMecanik`,
            description: `Les pièces ${data.gamme?.pg_name || ''} sont temporairement indisponibles. Découvrez nos alternatives.`,
            h1: `${data.gamme?.pg_name || 'Pièces'} - Temporairement indisponible`,
            canonical: '',
          },
        },
      );
    }

    // CASE 3: Véhicule incomplet → 412 Lock A (vehicle)
    // V3: Inclut compatibleGammes dans le résultat
    if (!intent.typeId && intent.gammeId) {
      const lock = this.buildLock('vehicle', intent, data);
      const gammeName = data.gamme?.pg_name || 'Pièces';

      return this.buildResult(
        'vehicle_incomplete',
        412,
        'Sélectionnez votre véhicule pour voir les pièces compatibles',
        {
          lock,
          substitute: this.mapSubstitute(data.substitute),
          diagnostic: data.diagnostic,
          relatedParts: this.mapRelatedParts(data.related_parts),
          compatibleGammes: this.mapCompatibleGammes(data.compatible_gammes),
          seo: {
            title: `${gammeName} - Sélectionnez votre véhicule | AutoMecanik`,
            description: `Trouvez le ${gammeName.toLowerCase()} compatible avec votre véhicule. Large choix, prix bas, livraison rapide.`,
            h1: `${gammeName} - Sélectionnez votre véhicule`,
            canonical: data.gamme?.pg_alias
              ? `/pieces/${data.gamme.pg_alias}-${data.gamme.pg_id}.html`
              : '',
          },
        },
      );
    }

    // CASE 4: Tout est résolu → 200 Catalogue normal
    const gammeName = data.gamme?.pg_name || 'Pièces';
    return this.buildResult('none', 200, 'Catalogue disponible', {
      substitute: this.mapSubstitute(data.substitute),
      diagnostic: data.diagnostic,
      relatedParts: this.mapRelatedParts(data.related_parts),
      seo: {
        title: `${gammeName} | AutoMecanik`,
        description: `Achetez ${gammeName.toLowerCase()} au meilleur prix. Livraison rapide et paiement sécurisé.`,
        h1: gammeName,
        canonical: data.gamme?.pg_alias
          ? `/pieces/${data.gamme.pg_alias}-${data.gamme.pg_id}.html`
          : '',
      },
    });
  }

  /**
   * Construit un SubstitutionLock pour le cas 412
   * "Dis-moi ce que tu as, et je te dirai ce que tu peux acheter"
   */
  private buildLock(
    type: LockType,
    intent: ExtractedIntent,
    data: SubstitutionDataResponse,
  ): SubstitutionLock {
    const lock: SubstitutionLock = {
      type,
      missing: this.getMissingDescription(type, intent),
      known: {},
      options: [],
    };

    // Remplir ce qu'on connaît
    if (data.gamme) {
      lock.known.gamme = {
        id: data.gamme.pg_id,
        name: data.gamme.pg_name,
        alias: data.gamme.pg_alias,
      };
    }

    // Remplir les options de déblocage (motorisations compatibles)
    // V3: Inclut les détails véhicule dans metadata
    if (type === 'vehicle' && data.compatible_motors) {
      lock.options = data.compatible_motors.map((motor) => ({
        id: motor.type_id,
        label: motor.type_name,
        url: this.buildVehicleUrl(intent, motor),
        description: motor.type_alias,
        metadata: {
          fuel: motor.type_fuel || null,
          power: motor.type_power_ps || null,
          years: this.formatYears(motor.type_year_from, motor.type_year_to),
          body: motor.type_body || null,
        },
      }));
    }

    return lock;
  }

  /**
   * Formate les années de production
   */
  private formatYears(
    yearFrom?: string,
    yearTo?: string | null,
  ): string | null {
    if (!yearFrom) return null;
    if (!yearTo) return `${yearFrom} - ...`;
    return `${yearFrom} - ${yearTo}`;
  }

  /**
   * Description du verrou selon le type
   */
  private getMissingDescription(
    type: LockType,
    intent: ExtractedIntent,
  ): string {
    switch (type) {
      case 'vehicle':
        if (!intent.marqueAlias) return 'Marque, modèle et motorisation';
        if (!intent.modeleAlias) return 'Modèle et motorisation';
        return 'Motorisation';
      case 'technology':
        return 'Type de technologie (plein/ventilé, essence/diesel)';
      case 'ambiguity':
        return 'Précision du terme (plusieurs significations possibles)';
      case 'precision':
        return 'Informations supplémentaires pour affiner la recherche';
      default:
        return 'Informations manquantes';
    }
  }

  /**
   * Construit l'URL vers une motorisation spécifique
   */
  private buildVehicleUrl(
    intent: ExtractedIntent,
    motor: { type_id: number; type_name: string; type_alias: string },
  ): string {
    const gamme = intent.gammeId
      ? `${intent.gammeAlias}-${intent.gammeId}`
      : intent.gammeAlias;
    const marque = intent.marqueId
      ? `${intent.marqueAlias}-${intent.marqueId}`
      : intent.marqueAlias || 'marque';
    const modele = intent.modeleId
      ? `${intent.modeleAlias}-${intent.modeleId}`
      : intent.modeleAlias || 'modele';
    const type = `${motor.type_alias}-${motor.type_id}`;

    return `/pieces/${gamme}/${marque}/${modele}/${type}.html`;
  }

  /**
   * Construit le résultat final
   */
  private buildResult(
    type: SubstitutionType,
    httpStatus: SubstitutionHttpStatus,
    message: string,
    extras: Partial<SubstitutionResult> = {},
  ): SubstitutionResult {
    const robots =
      httpStatus === 200 || httpStatus === 412 ? 'index, follow' : 'noindex';

    return {
      type,
      httpStatus,
      robots,
      message,
      seo: extras.seo || {
        title: 'AutoMecanik',
        description: message,
        h1: message,
        canonical: '',
      },
      ...extras,
    };
  }

  /**
   * Mapper substitute depuis la réponse RPC
   */
  private mapSubstitute(sub: SubstitutionDataResponse['substitute']) {
    if (!sub || !sub.piece_id) return undefined;
    const price = sub.piece_price ?? 0;
    return {
      piece_id: sub.piece_id,
      name: sub.piece_name || '',
      price,
      priceFormatted: price > 0 ? `${price.toFixed(2)} €` : '',
      image: sub.piece_image || '',
      brand: sub.pm_name || '',
      reference: sub.piece_ref || '',
      url: `/produit/${sub.piece_id}.html`,
    };
  }

  /**
   * Mapper relatedParts depuis la réponse RPC
   */
  private mapRelatedParts(parts: SubstitutionDataResponse['related_parts']) {
    if (!parts || parts.length === 0) return undefined;
    return parts.map((p) => ({
      pg_id: p.pg_id,
      pg_name: p.pg_name || '',
      pg_alias: p.pg_alias || '',
      image: p.pg_pic || '',
      minPrice: p.min_price ?? 0,
      url: `/pieces/${p.pg_alias}-${p.pg_id}.html`,
    }));
  }

  /**
   * Mapper suggestions depuis la réponse RPC
   */
  private mapSuggestions(sugg: SubstitutionDataResponse['suggestions']) {
    if (!sugg || sugg.length === 0) return undefined;
    return sugg.map((s) => ({
      label: s.pg_name,
      url: `/pieces/${s.pg_alias}-${s.pg_id}.html`,
      reason: (s.reason || 'popular') as
        | 'synonym'
        | 'typo'
        | 'family'
        | 'popular',
    }));
  }

  /**
   * V3: Mapper compatible_gammes depuis la réponse RPC
   */
  private mapCompatibleGammes(
    gammes: SubstitutionDataResponse['compatible_gammes'],
  ) {
    if (!gammes || gammes.length === 0) return undefined;
    return gammes.map((g) => ({
      pg_id: g.pg_id,
      pg_name: g.pg_name || '',
      pg_alias: g.pg_alias || '',
      pg_pic: g.pg_pic || undefined,
      total_pieces: g.total_pieces ?? 0,
      url: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
    }));
  }

  /**
   * Détecte si la requête vient d'un bot
   */
  private isBot(userAgent: string): boolean {
    const botPatterns =
      /bot|crawler|spider|googlebot|bingbot|yandex|duckduckbot|baiduspider/i;
    return botPatterns.test(userAgent);
  }
}
