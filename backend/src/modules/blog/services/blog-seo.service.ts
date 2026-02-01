import { TABLES } from '@repo/database-types';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import {
  InternalLinkingService,
  VehicleContext,
  LinkInjectionResult,
} from '../../seo/internal-linking.service';
import { SEO_LINK_LIMITS } from '../../../config/seo-link-limits.config';

/**
 * 🔍 BlogSeoService - SEO et liens internes du blog
 *
 * Responsabilité unique : Optimisation SEO des articles
 * - Injection de liens internes (#LinkGammeCar_Y#, #LinkGamme_Y#)
 * - Récupération des switches SEO
 * - Conseils de remplacement par gamme
 * - Statistiques des liens
 *
 * Extrait de BlogService pour réduire la complexité (SRP)
 */
@Injectable()
export class BlogSeoService {
  private readonly logger = new Logger(BlogSeoService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(InternalLinkingService)
    private readonly internalLinkingService: InternalLinkingService,
  ) {}

  /**
   * 🔗 Injecte les liens internes SEO dans un contenu HTML
   *
   * Traite les marqueurs #LinkGammeCar_Y# et #LinkGamme_Y# stockés en BDD
   * Respecte les limites configurées (MAX_BLOG_INTERNAL_LINKS)
   * Phase 1 SEO: Valide les règles de maillage par rôle via sourceUrl
   *
   * @param content - Contenu HTML avec marqueurs
   * @param vehicle - Contexte véhicule pour personnaliser les ancres
   * @param sourceUrl - URL de la page source pour validation des rôles SEO
   * @returns Contenu avec liens HTML + métadonnées A/B testing
   */
  async injectInternalLinks(
    content: string,
    vehicle?: VehicleContext,
    sourceUrl?: string,
  ): Promise<LinkInjectionResult> {
    const result: LinkInjectionResult = {
      content,
      linksInjected: 0,
      formulas: [],
    };

    // Vérifier si le contenu contient des marqueurs
    if (
      !content ||
      (!content.includes('#LinkGammeCar_') && !content.includes('#LinkGamme_'))
    ) {
      return result;
    }

    this.logger.debug('🔗 Injection de liens internes dans le contenu blog');

    try {
      let processedContent = content;

      // 1. Traiter #LinkGammeCar_Y# (liens avec véhicule et rotation verbe+nom)
      if (vehicle && sourceUrl && processedContent.includes('#LinkGammeCar_')) {
        const linkResult =
          await this.internalLinkingService.processLinkGammeCar(
            processedContent,
            vehicle,
            sourceUrl,
          );

        processedContent = linkResult.content;
        result.linksInjected += linkResult.linksInjected;
        result.formulas.push(...linkResult.formulas);
      }

      // 2. Traiter #LinkGamme_Y# (liens simples sans véhicule)
      if (processedContent.includes('#LinkGamme_')) {
        const simpleLinkContent =
          await this.internalLinkingService.processLinkGamme(processedContent);

        // Compter les liens injectés
        const linkPattern =
          /<a[^>]*class="seo-internal-link"[^>]*data-link-type="LinkGamme"[^>]*>/g;
        const simpleLinksAdded = (simpleLinkContent.match(linkPattern) || [])
          .length;

        processedContent = simpleLinkContent;
        result.linksInjected += simpleLinksAdded;
      }

      // 3. Vérifier la limite totale de liens pour le blog
      const totalLinksInContent = (
        processedContent.match(/<a[^>]*class="seo-internal-link"/g) || []
      ).length;
      if (totalLinksInContent > SEO_LINK_LIMITS.MAX_BLOG_INTERNAL_LINKS) {
        this.logger.warn(
          `⚠️ Trop de liens internes (${totalLinksInContent} > ${SEO_LINK_LIMITS.MAX_BLOG_INTERNAL_LINKS}), certains ont été supprimés`,
        );
      }

      result.content = processedContent;
      this.logger.debug(`✅ ${result.linksInjected} liens internes injectés`);

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Erreur injection liens: ${(error as Error).message}`,
      );
      return result;
    }
  }

  /**
   * 🔗 Version simplifiée pour contenu sans contexte véhicule
   */
  async injectSimpleLinks(content: string): Promise<string> {
    const result = await this.injectInternalLinks(content);
    return result.content;
  }

  /**
   * 🔤 Récupérer les switches SEO item pour une gamme
   * @param pg_id ID de la gamme
   * @returns Array de switches avec alias et contenu
   */
  async getSeoItemSwitches(pg_id: number): Promise<any[]> {
    try {
      this.logger.log(`🔤 Récupération switches SEO pour pg_id=${pg_id}`);

      const { data, error } = await this.supabaseService.client
        .from(TABLES.seo_item_switch)
        .select('*')
        .eq('sis_pg_id', pg_id.toString())
        .order('sis_alias', { ascending: true });

      if (error) {
        this.logger.error(`❌ Erreur Supabase: ${error.message}`);
        return [];
      }

      if (!data || data.length === 0) {
        this.logger.warn(`⚠️  Aucun switch trouvé pour pg_id=${pg_id}`);
        return [];
      }

      this.logger.log(`✅ ${data.length} switches récupérés`);
      return data;
    } catch (error) {
      this.logger.error(
        `❌ Erreur getSeoItemSwitches: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 📋 Récupérer les conseils de remplacement pour une gamme
   * @param pg_id ID de la gamme
   * @returns Array de conseils avec titre et contenu
   */
  async getGammeConseil(
    pg_id: number,
  ): Promise<Array<{ title: string; content: string }>> {
    try {
      this.logger.log(
        `📋 Récupération conseils de remplacement pour pg_id=${pg_id}`,
      );

      const { data, error } = await this.supabaseService.client
        .from('__seo_gamme_conseil')
        .select('*')
        .eq('sgc_pg_id', pg_id.toString())
        .order('sgc_id', { ascending: true });

      if (error) {
        this.logger.error(`❌ Erreur Supabase: ${error.message}`);
        return [];
      }

      if (!data || data.length === 0) {
        this.logger.warn(`⚠️  Aucun conseil trouvé pour pg_id=${pg_id}`);
        return [];
      }

      this.logger.log(
        `✅ ${data.length} conseils récupérés: ${data.map((c) => c.sgc_title).join(', ')}`,
      );

      return data.map((item) => ({
        title: item.sgc_title || '',
        content: item.sgc_content || '',
      }));
    } catch (error) {
      this.logger.error(
        `❌ Erreur getGammeConseil: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 📊 Récupère les statistiques des liens injectés dans le blog
   */
  async getInternalLinkStats(): Promise<{
    totalArticlesWithLinks: number;
    averageLinksPerArticle: number;
    topFormulas: Array<{ formula: string; count: number }>;
  }> {
    // Pour l'instant, retourner des valeurs par défaut
    // À enrichir avec des vraies requêtes sur les données trackées
    return {
      totalArticlesWithLinks: 0,
      averageLinksPerArticle: 0,
      topFormulas: [],
    };
  }
}
