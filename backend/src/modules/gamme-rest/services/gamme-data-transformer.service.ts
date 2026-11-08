import { Injectable } from '@nestjs/common';
import { buildPieceVehicleUrlRaw } from '../../../common/utils/url-builder.utils';
import { decodeHtmlEntities } from '../../../utils/html-entities';
// ⚠️ IMAGES: Utiliser image-urls.utils.ts - NE PAS définir de constantes locales
import {
  buildEquipementierLogoUrl,
  buildGammeImageUrl,
  IMAGE_CONFIG,
} from '../../catalog/utils/image-urls.utils';

/**
 * Service de transformation des données pour les pages gamme
 * Extrait la logique de traitement et nettoyage des données
 */
export interface ConseilRow {
  sgc_id: number;
  sgc_title?: string;
  sgc_content?: string;
}

export interface InformationRow {
  sgi_content: string;
}

export interface EquipementierRow {
  seg_pm_id?: string;
  pm_id?: string;
  pm_name?: string;
  pm_logo?: string;
  seg_content?: string;
  content?: string;
}

export interface CatalogueFamilleRow {
  pg_id: number;
  pg_alias: string;
  pg_pic?: string;
  /** Vignette catalogue/ (hors RPC, ajoutée par GammeRpcService.getGammeThumbnails) */
  pg_img?: string | null;
  pg_name: string;
  description?: string;
  meta_description?: string;
}

@Injectable()
export class GammeDataTransformerService {
  /**
   * Nettoie le contenu HTML et les entités
   * ✅ Utilise decodeHtmlEntities centralisé (80+ entités supportées)
   */
  contentCleaner(content: string): string {
    if (!content) return '';
    // Supprimer les balises HTML puis décoder les entités
    const withoutTags = content.replace(/<[^>]*>/g, '');
    return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
  }

  /**
   * Décode les entités HTML et remplace les variables
   * ✅ Utilise decodeHtmlEntities centralisé
   */
  cleanSeoText(text: string, marqueName: string): string {
    if (!text) return text;
    let cleanedText = decodeHtmlEntities(text);
    cleanedText = cleanedText.replace(/#VMarque#/g, marqueName);
    return cleanedText;
  }

  /**
   * Génère une URL de pièce avec véhicule
   * ✅ Utilise url-builder.utils.ts centralisé
   */
  buildPieceVehicleUrl(params: {
    gammeAlias: string;
    gammeId: number;
    marqueName: string;
    marqueId: number;
    modeleName: string;
    modeleId: number;
    typeName: string;
    typeId: number;
  }): string {
    return buildPieceVehicleUrlRaw(
      { alias: params.gammeAlias, id: params.gammeId },
      { alias: params.marqueName, id: params.marqueId },
      { alias: params.modeleName, id: params.modeleId },
      { alias: params.typeName, id: params.typeId },
    );
  }

  /**
   * Génère les méta SEO par défaut
   */
  generateDefaultSeo(pgNameSite: string, pgNameMeta: string) {
    return {
      title: pgNameMeta + ' neuf & à prix bas',
      description: `Votre ${pgNameMeta} au meilleur tarif, de qualité & à prix pas cher pour toutes marques et modèles de voitures.`,
      keywords: pgNameMeta,
      h1: `Choisissez ${pgNameSite} pas cher pour votre véhicule`,
      content: `Le(s) <b>${pgNameSite}</b> commercialisés sur Automecanik sont disponibles pour tous les modèles de véhicules.`,
    };
  }

  /**
   * Traite les données de conseils
   */
  processConseils(
    conseilsRaw: ConseilRow[],
  ): { id: number; title: string; content: string }[] {
    return conseilsRaw.map((conseil) => ({
      id: conseil.sgc_id,
      title: this.contentCleaner(conseil.sgc_title || ''),
      content: this.contentCleaner(conseil.sgc_content || ''),
    }));
  }

  /**
   * Traite les données d'informations
   */
  processInformations(informationsRaw: InformationRow[]): string[] {
    return informationsRaw.map((info) => info.sgi_content);
  }

  /**
   * Traite les équipementiers
   * ✅ Utilise pm_name et pm_logo depuis la RPC (jointure pieces_marque)
   * ✅ Utilise buildEquipementierLogoUrl centralisé
   */
  processEquipementiers(
    equipementiersRaw: EquipementierRow[],
  ): Record<string, unknown>[] {
    return equipementiersRaw.map((equip) => {
      const pmId = String(equip.seg_pm_id || equip.pm_id);
      const pmName = equip.pm_name || 'Équipementier';
      const pmLogo = equip.pm_logo || 'default.webp';

      // ✅ Utiliser la fonction centralisée
      const logoUrl = buildEquipementierLogoUrl(pmLogo);

      return {
        pm_id: pmId,
        pm_name: pmName,
        pm_logo: logoUrl,
        title: pmName,
        image: logoUrl,
        description: this.contentCleaner(
          equip.seg_content || equip.content || '',
        ),
      };
    });
  }

  /**
   * Traite le catalogue famille
   * ✅ Génère les liens et URLs d'images corrects pour le maillage interne
   * ✅ Utilise buildGammeImageUrl centralisé
   */
  processCatalogueFamille(
    catalogueFamilleRaw: CatalogueFamilleRow[],
  ): Record<string, unknown>[] {
    return catalogueFamilleRaw.map((piece) => {
      const pgId = piece.pg_id;
      const pgAlias = piece.pg_alias;
      // Vignette pg_img d'abord : pg_pic (hero) ne nomme pas toujours un objet catalogue/
      const thumbnail = piece.pg_img || piece.pg_pic;

      // 🔗 Générer le lien vers la page gamme
      const link = `/pieces/${pgAlias}-${pgId}.html`;

      // 📷 Générer l'URL de l'image via la fonction centralisée
      // Note: pg_alias.webp n'existe pas en Supabase Storage → utiliser DEFAULT_IMAGE
      const imageUrl = thumbnail
        ? buildGammeImageUrl(thumbnail)
        : IMAGE_CONFIG.DEFAULT_IMAGE;

      return {
        id: pgId,
        name: piece.pg_name,
        alias: pgAlias,
        image: imageUrl,
        link: link,
        description: this.contentCleaner(piece.description || ''),
        meta_description: this.contentCleaner(piece.meta_description || ''),
      };
    });
  }
}
