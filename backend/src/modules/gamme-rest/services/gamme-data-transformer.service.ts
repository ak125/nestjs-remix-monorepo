import { Injectable } from '@nestjs/common';
import { buildPieceVehicleUrlRaw } from '../../../common/utils/url-builder.utils';
import { decodeHtmlEntities } from '../../../utils/html-entities';

/**
 * Service de transformation des données pour les pages gamme
 * Extrait la logique de traitement et nettoyage des données
 */
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
  processConseils(conseilsRaw: any[]): any[] {
    return conseilsRaw.map((conseil: any) => ({
      id: conseil.sgc_id,
      title: this.contentCleaner(conseil.sgc_title || ''),
      content: this.contentCleaner(conseil.sgc_content || ''),
    }));
  }

  /**
   * Traite les données d'informations
   */
  processInformations(informationsRaw: any[]): string[] {
    return informationsRaw.map((info: any) => info.sgi_content);
  }

  /**
   * Traite les équipementiers
   */
  processEquipementiers(equipementiersRaw: any[]): any[] {
    const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads';
    
    // Mapping des IDs vers les noms d'équipementiers connus
    const equipementierNames: Record<string, { name: string; logo: string }> = {
      '730': { name: 'Bosch', logo: 'bosch.webp' },
      '1780': { name: 'FEBI', logo: 'febi.webp' },
      '1090': { name: 'CHAMPION', logo: 'champion.webp' },
      '1070': { name: 'MANN-FILTER', logo: 'mann-filter.webp' },
      '1120': { name: 'VALEO', logo: 'valeo.webp' },
      '1450': { name: 'MAHLE', logo: 'mahle.webp' },
      '1670': { name: 'HENGST', logo: 'hengst.webp' },
    };
    
    return equipementiersRaw.map((equip: any) => {
      const pmId = String(equip.seg_pm_id || equip.pm_id);
      const equipInfo = equipementierNames[pmId] || {
        name: equip.pm_name || 'Équipementier',
        logo: equip.pm_logo || 'default.webp'
      };
      
      const logoUrl = `${SUPABASE_URL}/equipementiers-automobiles/${equipInfo.logo}`;
      
      return {
        pm_id: pmId,
        pm_name: equipInfo.name,
        pm_logo: logoUrl,
        title: equipInfo.name,
        image: logoUrl,
        description: this.contentCleaner(equip.seg_content || equip.content || ''),
      };
    });
  }

  /**
   * Traite le catalogue famille
   */
  processCatalogueFamille(catalogueFamilleRaw: any[]): any[] {
    return catalogueFamilleRaw.map((piece: any) => ({
      id: piece.pg_id,
      name: piece.pg_name,
      alias: piece.pg_alias,
      image: piece.pg_pic,
      description: this.contentCleaner(piece.description || ''),
      meta_description: this.contentCleaner(piece.meta_description || ''),
    }));
  }
}
