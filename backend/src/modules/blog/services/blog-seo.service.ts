import { TABLES } from '@repo/database-types';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import {
  InternalLinkingService,
  VehicleContext,
  LinkInjectionResult,
} from '../../seo/internal-linking.service';
import { SEO_LINK_LIMITS } from '../../../config/seo-link-limits.config';
import { GENERIC_PHRASES } from '../../../config/conseil-pack.constants';
import { restoreAccents } from '../../../config/fr-accent-map';

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
  async getSeoItemSwitches(pg_id: number): Promise<Record<string, unknown>[]> {
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
  async getGammeConseil(pg_id: number): Promise<
    Array<{
      title: string;
      content: string;
      sectionType: string | null;
      order: number | null;
      qualityScore: number | null;
      sources: string[];
    }>
  > {
    try {
      this.logger.log(
        `📋 Récupération conseils de remplacement pour pg_id=${pg_id}`,
      );

      const { data, error } = await this.supabaseService.client
        .from('__seo_gamme_conseil')
        .select(
          'sgc_title, sgc_content, sgc_section_type, sgc_order, sgc_quality_score, sgc_sources',
        )
        .eq('sgc_pg_id', pg_id.toString())
        .order('sgc_order', { ascending: true, nullsFirst: false })
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

      const mapped = data.map((item) => ({
        title: item.sgc_title || '',
        content: item.sgc_content || '',
        sectionType: item.sgc_section_type || null,
        order: item.sgc_order ? Number(item.sgc_order) : null,
        qualityScore: item.sgc_quality_score ?? null,
        sources: this.parseSources(item.sgc_sources),
      }));

      return this.sanitizeConseilContent(mapped);
    } catch (error) {
      this.logger.error(
        `❌ Erreur getGammeConseil: ${(error as Error).message}`,
      );
      return [];
    }
  }

  // ── Quality gate en lecture ─────────────────────────────────

  /** Nettoie et normalise les sections conseil au read-time */
  private sanitizeConseilContent(
    sections: Array<{
      title: string;
      content: string;
      sectionType: string | null;
      order: number | null;
      qualityScore: number | null;
      sources: string[];
    }>,
  ): typeof sections {
    const cleaned = sections
      .filter(
        (s) =>
          s.content.length >= 80 &&
          !this.isTemplateContent(s.content) &&
          s.qualityScore !== 0,
      )
      .map((s) => ({
        ...s,
        content: restoreAccents(this.cleanWeakPhrases(s.content)),
        title: restoreAccents(this.normalizeTitle(s.title)),
      }));
    return this.deduplicateSections(cleaned);
  }

  /** Détecte le contenu boilerplate généré par template */
  private isTemplateContent(content: string): boolean {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    const templates = [
      /^renseignez marque,?\s*mod[eè]le/i,
      /^comment choisir vos?\s/i,
    ];
    return templates.some((p) => p.test(stripped));
  }

  /** Deduplicate sections by fingerprint (sectionType + first 200 chars of cleaned text) */
  private deduplicateSections<
    T extends { content: string; sectionType: string | null },
  >(sections: T[]): T[] {
    const seen = new Set<string>();
    return sections.filter((s) => {
      // Keep sections without a type (null) unconditionally
      if (!s.sectionType) return true;
      const stripped = s.content
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
      const fp = `${s.sectionType}::${stripped}`;
      if (seen.has(fp)) {
        this.logger.warn(
          `🔁 Duplicate section filtered: ${s.sectionType} — "${stripped.slice(0, 40)}…"`,
        );
        return false;
      }
      seen.add(fp);
      return true;
    });
  }

  /** Supprime les phrases faibles / anti-E-E-A-T du HTML */
  private cleanWeakPhrases(html: string): string {
    let cleaned = html;
    for (const pattern of GENERIC_PHRASES) {
      cleaned = cleaned.replace(pattern, '');
    }
    // Nettoyer les <p></p> vides résultants
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
    return cleaned;
  }

  /** Normalise les titres (trim, collapse whitespace, remove trailing colon) */
  private normalizeTitle(title: string): string {
    return title
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*:\s*$/, '');
  }

  /** Parse sgc_sources text column (JSON array of strings or objects with ref) */
  private parseSources(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((s) => {
          if (typeof s === 'string') return this.humanizeSourceRef(s);
          if (s && typeof s === 'object' && s.ref)
            return this.humanizeSource(s);
          return null;
        })
        .filter((s): s is string => s !== null)
        .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
    } catch {
      return [];
    }
  }

  /** Convert internal source metadata into user-facing labels */
  private humanizeSource(s: { type?: string; ref?: string }): string {
    if (s.type === 'rag' && s.ref?.startsWith('gammes/'))
      return 'Équipe technique AutoMecanik';
    if (s.type === 'rag') return 'Documentation technique';
    if (s.ref?.includes('OEM') || s.ref === 'OEM_manual')
      return 'Manuel constructeur';
    if (s.ref?.endsWith('.pdf')) return 'Documentation technique';
    return 'Source vérifiée';
  }

  /** Convert raw string source refs into user-facing labels */
  private humanizeSourceRef(ref: string): string {
    if (ref.startsWith('gammes/')) return 'Équipe technique AutoMecanik';
    if (ref.includes('OEM')) return 'Manuel constructeur';
    if (ref.endsWith('.pdf')) return 'Documentation technique';
    return ref;
  }

  /**
   * 🖼️ Récupère les images approuvées pour une gamme (pour injection R3 Guide)
   * Ne retourne que les images avec rip_selected=true, rip_image_url IS NOT NULL,
   * et rip_status IN ('approved', 'exported').
   */
  async getApprovedImages(pgId: number): Promise<
    Array<{
      sectionId: string;
      src: string;
      alt: string;
      caption: string | null;
      aspectRatio: '16:9' | '4:3';
    }>
  > {
    try {
      const { data, error } = await this.supabaseService.client
        .from('__seo_r3_image_prompts')
        .select(
          'rip_section_id, rip_image_url, rip_alt_text, rip_caption, rip_aspect_ratio',
        )
        .eq('rip_pg_id', pgId)
        .eq('rip_selected', true)
        .not('rip_image_url', 'is', null)
        .in('rip_status', ['approved', 'exported']);

      if (error || !data) return [];

      return data.map((row) => ({
        sectionId: row.rip_section_id,
        src: row.rip_image_url,
        alt: row.rip_alt_text || '',
        caption: row.rip_caption || null,
        aspectRatio:
          row.rip_aspect_ratio === '4:3' ? ('4:3' as const) : ('16:9' as const),
      }));
    } catch {
      return [];
    }
  }

  /**
   * 🎯 Récupère le SEO brief (meta_title, meta_description) depuis le pipeline R3.
   * Source : __seo_r3_keyword_plan.skp_seo_brief (rempli par P10 META).
   * Retourne null si aucun plan n'existe pour cette gamme.
   */
  async getSeoBrief(pgId: number): Promise<{
    meta_title?: string;
    meta_description?: string;
    recommended_anchors?: string[];
  } | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('__seo_r3_keyword_plan')
        .select('skp_seo_brief, skp_status, skp_quality_score')
        .eq('skp_pg_id', pgId)
        .not('skp_seo_brief', 'is', null)
        .order('skp_quality_score', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const brief = data.skp_seo_brief as Record<string, unknown> | null;
      if (!brief?.meta_title && !brief?.meta_description) return null;

      this.logger.log(
        `🎯 SEO brief trouvé pour pg_id=${pgId} (status=${data.skp_status}, score=${data.skp_quality_score})`,
      );

      return {
        meta_title: brief.meta_title as string | undefined,
        meta_description: brief.meta_description as string | undefined,
        recommended_anchors: brief.recommended_anchors as string[] | undefined,
      };
    } catch (err) {
      this.logger.warn(`⚠️ getSeoBrief(${pgId}): ${(err as Error).message}`);
      return null;
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

  /**
   * Check if a published R6 guide-achat exists for a given pg_id.
   * Used by R3 pages to inject cross-link CTA toward the R6 guide.
   */
  async hasPublishedR6Guide(pgId: number): Promise<boolean> {
    const client = this.supabaseService.getClient();
    const { data } = await client
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_id')
      .eq('sgpg_pg_id', pgId)
      .eq('sgpg_is_draft', false)
      .limit(1)
      .maybeSingle();
    return !!data;
  }
}
