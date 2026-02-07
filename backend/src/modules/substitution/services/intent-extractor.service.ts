import { Injectable, Logger } from '@nestjs/common';
import { ExtractedIntent } from '../types/substitution.types';
import { getErrorMessage } from '../../../common/utils/error.utils';

/**
 * Service d'extraction d'intention depuis l'URL
 * Parse les tokens pour identifier ce que cherche l'utilisateur
 */
@Injectable()
export class IntentExtractorService {
  private readonly logger = new Logger(IntentExtractorService.name);

  /**
   * Extrait l'intention depuis un pathname
   *
   * @param pathname - Ex: /pieces/freinage-402/renault-4/clio-5/type-123.html
   * @returns ExtractedIntent avec les tokens parses
   */
  extractFromPathname(pathname: string): ExtractedIntent {
    const intent: ExtractedIntent = {
      gammeAlias: '',
      gammeId: null,
      marqueAlias: null,
      marqueId: null,
      modeleAlias: null,
      modeleId: null,
      typeAlias: null,
      typeId: null,
      pieceId: null,
      rawTokens: [],
      urlType: 'unknown',
      confidence: 0,
    };

    try {
      // Nettoyer le pathname
      const cleanPath = pathname
        .replace(/\.html$/, '')
        .replace(/^\//, '')
        .toLowerCase();

      const segments = cleanPath.split('/').filter(Boolean);
      intent.rawTokens = segments;

      if (segments.length === 0) {
        return intent;
      }

      // Pattern 1: /pieces/{gamme-id}
      if (segments[0] === 'pieces' && segments.length === 2) {
        const gammeInfo = this.parseSlugWithId(segments[1]);
        intent.gammeAlias = gammeInfo.alias;
        intent.gammeId = gammeInfo.id;
        intent.urlType = 'gamme_only';
        intent.confidence = gammeInfo.id ? 0.9 : 0.5;
        return intent;
      }

      // Pattern 2: /pieces/{gamme}/{marque}/{modele}/{type}
      if (segments[0] === 'pieces' && segments.length === 5) {
        const gammeInfo = this.parseSlugWithId(segments[1]);
        const marqueInfo = this.parseSlugWithId(segments[2]);
        const modeleInfo = this.parseSlugWithId(segments[3]);
        const typeInfo = this.parseSlugWithId(segments[4]);

        intent.gammeAlias = gammeInfo.alias;
        intent.gammeId = gammeInfo.id;
        intent.marqueAlias = marqueInfo.alias;
        intent.marqueId = marqueInfo.id;
        intent.modeleAlias = modeleInfo.alias;
        intent.modeleId = modeleInfo.id;
        intent.typeAlias = typeInfo.alias;
        intent.typeId = typeInfo.id;
        intent.urlType = 'gamme_vehicle';

        // Confiance basee sur le nombre d'IDs extraits
        const idsFound = [
          gammeInfo.id,
          marqueInfo.id,
          modeleInfo.id,
          typeInfo.id,
        ].filter(Boolean).length;
        intent.confidence = idsFound / 4;

        return intent;
      }

      // Pattern 3: /constructeurs/{marque}/{modele}/{type}
      if (segments[0] === 'constructeurs' && segments.length >= 4) {
        const marqueInfo = this.parseSlugWithId(segments[1]);
        const modeleInfo = this.parseSlugWithId(segments[2]);
        const typeInfo = this.parseSlugWithId(segments[3]);

        intent.marqueAlias = marqueInfo.alias;
        intent.marqueId = marqueInfo.id;
        intent.modeleAlias = modeleInfo.alias;
        intent.modeleId = modeleInfo.id;
        intent.typeAlias = typeInfo.alias;
        intent.typeId = typeInfo.id;
        intent.urlType = 'gamme_vehicle';
        intent.confidence = 0.7;

        return intent;
      }

      // Pattern 4: /produit/{id} ou /piece/{ref}
      if (
        (segments[0] === 'produit' || segments[0] === 'piece') &&
        segments.length >= 2
      ) {
        const pieceInfo = this.parseSlugWithId(segments[1]);
        intent.pieceId = pieceInfo.id;
        intent.urlType = 'product';
        intent.confidence = pieceInfo.id ? 0.9 : 0.3;
        return intent;
      }

      // Pattern inconnu - extraire ce qu'on peut
      intent.urlType = 'unknown';
      intent.confidence = 0.1;

      // Essayer de trouver des IDs dans les segments
      for (const segment of segments) {
        const info = this.parseSlugWithId(segment);
        if (info.id && !intent.gammeId) {
          intent.gammeAlias = info.alias;
          intent.gammeId = info.id;
          intent.confidence = 0.3;
        }
      }

      return intent;
    } catch (error) {
      this.logger.warn(
        `Erreur extraction intention: ${getErrorMessage(error)}`,
        pathname,
      );
      return intent;
    }
  }

  /**
   * Parse un slug de type "alias-id" ou "alias"
   *
   * @param slug - Ex: "freinage-402" ou "renault"
   * @returns { alias: string, id: number | null }
   */
  private parseSlugWithId(slug: string): { alias: string; id: number | null } {
    if (!slug) {
      return { alias: '', id: null };
    }

    // Pattern: alias-123 (ID a la fin)
    const match = slug.match(/^(.+?)-(\d+)$/);
    if (match) {
      return {
        alias: match[1],
        id: parseInt(match[2], 10),
      };
    }

    // Pas d'ID trouve
    return {
      alias: slug,
      id: null,
    };
  }

  /**
   * Reconstruit l'URL vehicule depuis l'intention
   */
  buildVehicleUrl(intent: ExtractedIntent): string | null {
    if (!intent.marqueAlias || !intent.modeleAlias || !intent.typeAlias) {
      return null;
    }

    const marque = intent.marqueId
      ? `${intent.marqueAlias}-${intent.marqueId}`
      : intent.marqueAlias;
    const modele = intent.modeleId
      ? `${intent.modeleAlias}-${intent.modeleId}`
      : intent.modeleAlias;
    const type = intent.typeId
      ? `${intent.typeAlias}-${intent.typeId}`
      : intent.typeAlias;

    return `/constructeurs/${marque}/${modele}/${type}.html`;
  }

  /**
   * Reconstruit l'URL gamme depuis l'intention
   */
  buildGammeUrl(intent: ExtractedIntent): string | null {
    if (!intent.gammeAlias) {
      return null;
    }

    const gamme = intent.gammeId
      ? `${intent.gammeAlias}-${intent.gammeId}`
      : intent.gammeAlias;

    return `/pieces/${gamme}.html`;
  }

  /**
   * Reconstruit l'URL gamme + vehicule depuis l'intention
   */
  buildGammeVehicleUrl(intent: ExtractedIntent): string | null {
    if (
      !intent.gammeAlias ||
      !intent.marqueAlias ||
      !intent.modeleAlias ||
      !intent.typeAlias
    ) {
      return null;
    }

    const gamme = intent.gammeId
      ? `${intent.gammeAlias}-${intent.gammeId}`
      : intent.gammeAlias;
    const marque = intent.marqueId
      ? `${intent.marqueAlias}-${intent.marqueId}`
      : intent.marqueAlias;
    const modele = intent.modeleId
      ? `${intent.modeleAlias}-${intent.modeleId}`
      : intent.modeleAlias;
    const type = intent.typeId
      ? `${intent.typeAlias}-${intent.typeId}`
      : intent.typeAlias;

    return `/pieces/${gamme}/${marque}/${modele}/${type}.html`;
  }

  /**
   * Detecte si la requete vient d'un bot suspect
   */
  isSuspiciousBot(userAgent: string): boolean {
    if (!userAgent || userAgent.trim() === '') {
      return true;
    }

    // Bots legitimes - ne pas bloquer
    const legitimateBots = [
      'googlebot',
      'bingbot',
      'yandexbot',
      'duckduckbot',
      'baiduspider',
      'facebookexternalhit',
      'twitterbot',
      'linkedinbot',
      'slackbot',
      'whatsapp',
      'telegrambot',
      'applebot',
    ];

    const uaLower = userAgent.toLowerCase();
    if (legitimateBots.some((bot) => uaLower.includes(bot))) {
      return false;
    }

    // Patterns suspects
    const suspiciousPatterns = [
      /^python-requests/i,
      /^python-urllib/i,
      /^java\//i,
      /^apache-httpclient/i,
      /masscan/i,
      /nikto/i,
      /sqlmap/i,
      /nmap/i,
      /scrapy/i,
      /phantomjs/i,
      /headless/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }
}
