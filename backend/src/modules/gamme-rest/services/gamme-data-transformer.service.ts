import { Injectable } from '@nestjs/common';

/**
 * Service de transformation des données pour les pages gamme
 * Extrait la logique de traitement et nettoyage des données
 */
@Injectable()
export class GammeDataTransformerService {
  /**
   * Nettoie le contenu HTML et les entités
   */
  contentCleaner(content: string): string {
    if (!content) return '';
    return this.cleanHtmlContent(content);
  }

  /**
   * Nettoie le contenu HTML
   */
  private cleanHtmlContent(content: string): string {
    if (!content) return '';
    const withoutTags = content.replace(/<[^>]*>/g, '');
    const decoded = withoutTags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    return decoded.replace(/\s+/g, ' ').trim();
  }

  /**
   * Décode les entités HTML et remplace les variables
   */
  cleanSeoText(text: string, marqueName: string): string {
    if (!text) return text;
    
    const htmlEntities: Record<string, string> = {
      '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&euml;': 'ë',
      '&agrave;': 'à', '&acirc;': 'â', '&auml;': 'ä',
      '&ocirc;': 'ô', '&ouml;': 'ö', '&ograve;': 'ò',
      '&icirc;': 'î', '&iuml;': 'ï', '&igrave;': 'ì',
      '&ucirc;': 'û', '&ugrave;': 'ù', '&uuml;': 'ü',
      '&ccedil;': 'ç', '&rsquo;': "'", '&lsquo;': "'",
      '&rdquo;': '"', '&ldquo;': '"', '&nbsp;': ' ',
      '&amp;': '&', '&lt;': '<', '&gt;': '>',
    };
    
    let cleanedText = text;
    Object.entries(htmlEntities).forEach(([entity, char]) => {
      cleanedText = cleanedText.replace(new RegExp(entity, 'g'), char);
    });
    
    cleanedText = cleanedText.replace(/#VMarque#/g, marqueName);
    
    return cleanedText;
  }

  /**
   * Génère une URL de pièce avec véhicule
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
    const slugify = (text: string): string => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    return [
      '/pieces',
      `${slugify(params.gammeAlias)}-${params.gammeId}`,
      `${slugify(params.marqueName)}-${params.marqueId}`,
      `${slugify(params.modeleName)}-${params.modeleId}`,
      `${slugify(params.typeName)}-${params.typeId}.html`
    ].join('/');
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
    return equipementiersRaw.map((equip: any) => ({
      pm_id: equip.seg_pm_id,
      content: this.contentCleaner(equip.seg_content || ''),
    }));
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
