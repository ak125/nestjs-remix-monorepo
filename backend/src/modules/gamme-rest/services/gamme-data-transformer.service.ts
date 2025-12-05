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
   * ✅ Utilise pm_name et pm_logo depuis la RPC (jointure pieces_marque)
   */
  processEquipementiers(equipementiersRaw: any[]): any[] {
    const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads';
    
    return equipementiersRaw.map((equip: any) => {
      const pmId = String(equip.seg_pm_id || equip.pm_id);
      const pmName = equip.pm_name || 'Équipementier';
      const pmLogo = equip.pm_logo || 'default.webp';
      
      // Construire l'URL du logo
      const logoUrl = `${SUPABASE_URL}/equipementiers-automobiles/${pmLogo}`;
      
      return {
        pm_id: pmId,
        pm_name: pmName,
        pm_logo: logoUrl,
        title: pmName,
        image: logoUrl,
        description: this.contentCleaner(equip.seg_content || equip.content || ''),
      };
    });
  }

  /**
   * Traite le catalogue famille
   * ✅ Génère les liens et URLs d'images corrects pour le maillage interne
   */
  processCatalogueFamille(catalogueFamilleRaw: any[]): any[] {
    const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads';
    
    return catalogueFamilleRaw.map((piece: any) => {
      const pgId = piece.pg_id;
      const pgAlias = piece.pg_alias;
      const pgPic = piece.pg_pic;
      
      // 🔗 Générer le lien vers la page gamme
      const link = `/pieces/${pgAlias}-${pgId}.html`;
      
      // 📷 Générer l'URL de l'image
      // Les images sont stockées dans articles/gammes-produits/catalogue/{alias}.webp
      let imageUrl: string;
      if (pgPic) {
        if (pgPic.startsWith('http')) {
          imageUrl = pgPic;
        } else if (pgPic.startsWith('/')) {
          imageUrl = pgPic;
        } else {
          // Utiliser pg_alias pour construire le chemin correct
          // Format: articles/gammes-produits/catalogue/nom-gamme.webp
          imageUrl = `${SUPABASE_URL}/articles/gammes-produits/catalogue/${pgAlias}.webp`;
        }
      } else {
        // Fallback: essayer avec pg_alias si pg_pic est vide
        if (pgAlias) {
          imageUrl = `${SUPABASE_URL}/articles/gammes-produits/catalogue/${pgAlias}.webp`;
        } else {
          imageUrl = '/images/default-piece.jpg';
        }
      }
      
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
