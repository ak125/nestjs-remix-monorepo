/**
 * 🏷️ BRAND SEO SERVICE
 *
 * Service pour gérer le contenu SEO des pages marque depuis __seo_marque
 * Intégration des variables: #VMarque#, #PrixPasCher#
 *
 * @table __seo_marque (35 lignes)
 * @columns sm_id, sm_title, sm_descrip, sm_keywords, sm_h1, sm_content, sm_marque_id
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { TABLES } from '@repo/database-types';
import { getEffectiveSupabaseKey } from '@common/utils';
import {
  SEO_PRICE_VARIATIONS,
  selectVariation,
} from '../../../../config/seo-variations.config';

export interface BrandSeoData {
  sm_id: string;
  sm_title: string;
  sm_descrip: string;
  sm_keywords: string;
  sm_h1: string;
  sm_content: string;
  sm_marque_id: string;
}

export interface ProcessedBrandSeo {
  title: string;
  description: string;
  h1: string;
  content: string;
  contentText: string; // Version sans HTML
  keywords: string;
}

@Injectable()
export class BrandSeoService {
  private readonly logger = new Logger(BrandSeoService.name);
  private supabase: SupabaseClient;

  constructor() {
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      getEffectiveSupabaseKey(),
    );
    this.logger.log('✅ BrandSeoService initialisé');
  }

  /**
   * Récupère le contenu SEO d'une marque
   * @param marqueId ID de la marque (auto_marque.marque_id)
   * @returns Données SEO brutes ou null
   */
  async getBrandSeo(marqueId: number): Promise<BrandSeoData | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.seo_marque)
        .select('*')
        .eq('sm_marque_id', marqueId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          // PGRST116 = pas de résultat (normal)
          this.logger.warn(
            `⚠️ Erreur récupération SEO marque ${marqueId}: ${error.message}`,
          );
        }
        return null;
      }

      return data as BrandSeoData;
    } catch (err) {
      this.logger.error(`❌ Exception getBrandSeo marque ${marqueId}:`, err);
      return null;
    }
  }

  /**
   * Traite les variables SEO d'une marque
   * @param seoData Données SEO brutes
   * @param marqueNom Nom de la marque (ex: "Renault")
   * @param typeId ID du type pour rotation #PrixPasCher#
   * @returns Données SEO avec variables remplacées
   */
  processBrandSeoVariables(
    seoData: BrandSeoData,
    marqueNom: string,
    typeId: number = 0,
  ): ProcessedBrandSeo {
    // Variables simples
    const replacements: Record<string, string> = {
      '#VMarque#': marqueNom,
    };

    // Variation marketing #PrixPasCher# (rotation sur 7 variations canoniques)
    replacements['#PrixPasCher#'] = selectVariation(
      SEO_PRICE_VARIATIONS,
      typeId,
    );

    // Appliquer tous les remplacements
    let title = seoData.sm_title || '';
    let description = seoData.sm_descrip || '';
    let h1 = seoData.sm_h1 || '';
    let content = seoData.sm_content || '';

    Object.entries(replacements).forEach(([marker, value]) => {
      const regex = new RegExp(marker.replace(/[#]/g, '\\$&'), 'g');
      title = title.replace(regex, value);
      description = description.replace(regex, value);
      h1 = h1.replace(regex, value);
      content = content.replace(regex, value);
    });

    return {
      title: this.cleanText(title),
      description: this.cleanText(description),
      h1: this.cleanText(h1),
      content: this.decodeHtmlContent(content), // Contenu avec HTML
      contentText: this.stripHtmlTags(this.decodeHtmlContent(content)), // Version texte pur
      keywords: seoData.sm_keywords || '',
    };
  }

  /**
   * Supprime toutes les balises HTML
   */
  private stripHtmlTags(html: string): string {
    if (!html) return '';

    return html
      .replace(/<[^>]*>/g, '') // Supprime toutes les balises
      .replace(/\s+/g, ' ') // Normalise espaces
      .trim();
  }

  /**
   * Nettoyage et décodage du texte SEO
   */
  private cleanText(text: string): string {
    return text
      .replace(/#[A-Za-z]+#/g, '') // Supprime variables non remplacées
      .replace(/&nbsp;/g, ' ') // Décode &nbsp;
      .replace(/&amp;/g, '&') // Décode &amp;
      .replace(/&lt;/g, '<') // Décode &lt;
      .replace(/&gt;/g, '>') // Décode &gt;
      .replace(/&quot;/g, '"') // Décode &quot;
      .replace(/&#39;/g, "'") // Décode &#39;
      .replace(/\s+/g, ' ') // Espaces multiples
      .trim();
  }

  /**
   * Décode les entités HTML dans le contenu riche
   */
  private decodeHtmlContent(html: string): string {
    if (!html) return '';

    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&agrave;/g, 'à')
      .replace(/&acirc;/g, 'â')
      .replace(/&eacute;/g, 'é')
      .replace(/&egrave;/g, 'è')
      .replace(/&ecirc;/g, 'ê')
      .replace(/&icirc;/g, 'î')
      .replace(/&ocirc;/g, 'ô')
      .replace(/&ucirc;/g, 'û')
      .replace(/&ccedil;/g, 'ç');
  }

  /**
   * Récupère ET traite le SEO d'une marque en une seule opération
   * @param marqueId ID marque
   * @param marqueNom Nom marque
   * @param typeId ID type pour rotation
   * @returns SEO traité ou null
   */
  async getProcessedBrandSeo(
    marqueId: number,
    marqueNom: string,
    typeId: number = 0,
  ): Promise<ProcessedBrandSeo | null> {
    const seoData = await this.getBrandSeo(marqueId);

    if (!seoData) {
      this.logger.debug(
        `ℹ️ Pas de SEO custom pour marque ${marqueNom} (ID ${marqueId})`,
      );
      return null;
    }

    this.logger.debug(
      `✅ SEO marque ${marqueNom} récupéré et traité (ID ${marqueId})`,
    );

    return this.processBrandSeoVariables(seoData, marqueNom, typeId);
  }

  /**
   * Génère un SEO par défaut si aucune donnée custom
   */
  generateDefaultBrandSeo(marqueNom: string): ProcessedBrandSeo {
    const content = `Découvrez notre catalogue complet de pièces auto pour ${marqueNom}. Toutes les pièces d'usure et d'entretien disponibles en stock.`;

    return {
      title: `Pièces auto ${marqueNom} pas cher - Automecanik`,
      description: `Achetez des pièces détachées d'origine pour ${marqueNom}. Freinage, embrayage, distribution. Livraison rapide et garantie constructeur.`,
      h1: `Pièces détachées ${marqueNom}`,
      content,
      contentText: content,
      keywords: `${marqueNom}, pièces auto ${marqueNom}, pièces détachées ${marqueNom}`,
    };
  }

  /**
   * Met à jour le SEO d'une marque dans __seo_marque
   * @param marqueId ID de la marque
   * @param seoData Données SEO à mettre à jour
   * @returns Données mises à jour
   */
  async updateBrandSeo(
    marqueId: number,
    seoData: {
      sm_title?: string;
      sm_descrip?: string;
      sm_h1?: string;
      sm_content?: string;
      sm_keywords?: string;
    },
  ): Promise<BrandSeoData | null> {
    try {
      // Vérifier si une entrée existe déjà
      const existing = await this.getBrandSeo(marqueId);

      if (existing) {
        // UPDATE
        const { data, error } = await this.supabase
          .from(TABLES.seo_marque)
          .update({
            sm_title: seoData.sm_title,
            sm_descrip: seoData.sm_descrip,
            sm_h1: seoData.sm_h1,
            sm_content: seoData.sm_content,
            sm_keywords: seoData.sm_keywords,
          })
          .eq('sm_marque_id', marqueId)
          .select()
          .single();

        if (error) {
          this.logger.error(`❌ Erreur UPDATE SEO marque ${marqueId}:`, error);
          throw error;
        }

        this.logger.log(`✅ SEO marque ${marqueId} mis à jour`);
        return data as BrandSeoData;
      } else {
        // INSERT
        const { data, error } = await this.supabase
          .from(TABLES.seo_marque)
          .insert({
            sm_marque_id: marqueId,
            sm_title: seoData.sm_title || '',
            sm_descrip: seoData.sm_descrip || '',
            sm_h1: seoData.sm_h1 || '',
            sm_content: seoData.sm_content || '',
            sm_keywords: seoData.sm_keywords || '',
          })
          .select()
          .single();

        if (error) {
          this.logger.error(`❌ Erreur INSERT SEO marque ${marqueId}:`, error);
          throw error;
        }

        this.logger.log(`✅ SEO marque ${marqueId} créé`);
        return data as BrandSeoData;
      }
    } catch (err) {
      this.logger.error(`❌ Exception updateBrandSeo marque ${marqueId}:`, err);
      throw err;
    }
  }
}
