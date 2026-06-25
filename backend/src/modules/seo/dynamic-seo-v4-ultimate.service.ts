/**
 * 🎯 DYNAMIC SEO V4 ULTIMATE — orchestrateur stateless
 *
 * Cette classe est devenue, en PR-2c (plan seo-v9), un **adaptateur fin** vers
 * la chaîne SEO commune (`SeoChainOrchestratorService`). Elle conserve son API
 * publique historique `generateCompleteSeo(pgId, typeId, variables) → CompleteSeoResult`
 * (consommée par 4 endpoints debug `/api/seo-dynamic-v4/*` cf. audit PR-1)
 * mais ne contient plus aucune logique métier propre :
 *
 *   1. parse Zod des variables legacy
 *   2. lookup cache résultat (clé pgId+typeId+vars)
 *   3. construit un `SeoChainInput` (surface = R1_GAMME_VEHICLE_ROUTER pour le legacy)
 *   4. délègue à `SeoChainOrchestratorService.run(input)`
 *   5. adapte `SeoChainOutput` → `CompleteSeoResult` (compat tests / controllers)
 *   6. fallback `generateDefaultSeo` si la chaîne renvoie un title vide
 *
 * Cache + monitoring proxy + variantes fallback = conservés (utiles pour
 * le mode debug). Tout le reste (`processTitle/Description/H1/Preview/Content`,
 * `replaceStandardVariables`, `processContextualVariables`,
 * `getSeoTemplate/getItemSwitches/getGammeCarSwitches/getFamilySwitches`) est
 * supprimé : la chaîne PR-2c gère l'intégralité de cette logique de manière
 * canonique et testée.
 *
 * @version 4.1.0 (refactor seo-v9 PR-2c)
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { SeoChainOrchestratorService } from './services/chain/seo-chain-orchestrator.service';
import { SeoV4MonitoringService } from './services/seo-v4-monitoring.service';
import {
  SeoVariablesSchema,
  SeoVariables,
  CompleteSeoResult,
  SeoAuditReport,
  SeoMetrics,
  SeoAbTestVariant,
  InternalLinkMetrics,
} from './seo-v4.types';

// Re-export types for backward compatibility
export {
  SeoVariables,
  CompleteSeoResult,
  SeoAuditReport,
  SeoMetrics,
  SeoAbTestVariant,
  InternalLinkMetrics,
} from './seo-v4.types';

@Injectable()
export class DynamicSeoV4UltimateService extends SupabaseBaseService {
  protected readonly logger = new Logger(DynamicSeoV4UltimateService.name);

  // Cache for complete SEO results (clé = pgId+typeId+vars sérialisés).
  private seoCache = new Map<
    string,
    { data: CompleteSeoResult; expires: number }
  >();
  private readonly CACHE_TTL_SHORT = 300_000; // 5 min
  private readonly CACHE_TTL_MEDIUM = 900_000; // 15 min
  private readonly CACHE_TTL_LONG = 3_600_000; // 1 h

  // Metrics tracking state (proxy `SeoV4MonitoringService`).
  private cacheHits = 0;
  private cacheMisses = 0;
  private processingTimes: number[] = [];
  private unknownPagesDetected: Array<{
    pgId: number;
    typeId: number;
    timestamp: Date;
  }> = [];

  constructor(
    private readonly chain: SeoChainOrchestratorService,
    private readonly monitoring: SeoV4MonitoringService,
  ) {
    super();
  }

  // ====================================
  // 🎯 MAIN ENTRY POINT (legacy compat)
  // ====================================

  async generateCompleteSeo(
    pgId: number,
    typeId: number,
    variables: SeoVariables,
  ): Promise<CompleteSeoResult> {
    const startTime = Date.now();

    // Fail-CLOSED à l'entrée chaîne (A1b) : `safeParse` plutôt que `.parse()`.
    // Variables invalides → 400 explicite/observable, levé AVANT le `try` plus
    // bas — donc le throw échappe au `catch` fail-open (qui retournerait
    // `generateDefaultSeo`) : on ne compose JAMAIS une page depuis des variables
    // invalides. Inputs valides → `parsed.data` identique à l'ancien `.parse()`
    // (sortie inchangée). Seuls appelants = les 4 endpoints debug V4.
    const parsed = SeoVariablesSchema.safeParse(variables);
    if (!parsed.success) {
      this.logger.error(
        `❌ [SEO V4→chain] SeoVariables invalides (pgId=${pgId}, typeId=${typeId}) : ${JSON.stringify(
          parsed.error.flatten(),
        )}`,
      );
      throw new BadRequestException(parsed.error.flatten());
    }
    const validatedVars = parsed.data;

    this.logger.log(
      `🎯 [SEO V4→chain] Génération complète : pgId=${pgId}, typeId=${typeId}`,
    );

    const cacheKey = `seo:complete:${pgId}:${typeId}:${JSON.stringify(validatedVars)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.logger.debug('📦 [CACHE HIT] SEO complet');
      return { ...cached, metadata: { ...cached.metadata, cacheHit: true } };
    }

    try {
      const chainOutput = await this.chain.run({
        // Le legacy V4 supposait toujours un contexte gamme×véhicule
        // (cf. dynamic-seo.controller.ts → c'est le seul appelant).
        surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        pgId,
        typeId,
        vehicleId: typeId,
        variables: validatedVars,
        ids: {},
        baseUrl: '',
        breadcrumbs: [],
      });

      // Si la chaîne n'a pas trouvé de template DB, on tombe sur le fallback
      // legacy (titre/description programmatiques par contexte).
      if (!chainOutput.template.title) {
        const fallback = this.generateDefaultSeo(validatedVars, startTime);
        this.setCachedData(cacheKey, fallback, this.getCacheTTL(validatedVars));
        return fallback;
      }

      const result = this.adaptChainOutput(chainOutput, startTime);
      this.setCachedData(cacheKey, result, this.getCacheTTL(validatedVars));

      this.processingTimes.push(result.metadata.processingTime);
      this.logger.log(
        `✅ [SEO V4→chain] Succès en ${result.metadata.processingTime}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `❌ [SEO V4→chain] Erreur : ${(error as Error).message}`,
      );
      return this.generateDefaultSeo(validatedVars, startTime);
    }
  }

  // ====================================
  // 🔁 CHAIN OUTPUT → CompleteSeoResult adapter
  // ====================================

  private adaptChainOutput(
    chain: Awaited<ReturnType<SeoChainOrchestratorService['run']>>,
    startTime: number,
  ): CompleteSeoResult {
    const processingTime = Date.now() - startTime;
    const variantCount = Object.values(chain.metadata.variantIds).filter(
      (v) => v != null,
    ).length;

    return {
      title: this.cleanContent(chain.template.title, true),
      description: this.cleanContent(chain.template.description),
      h1: chain.template.h1,
      preview: chain.template.preview,
      content: chain.template.content,
      keywords: chain.template.keywords,
      metadata: {
        templatesUsed: chain.metadata.templateId
          ? [chain.metadata.templateId]
          : ['default'],
        switchesProcessed: variantCount + chain.metadata.internalLinkCount,
        variablesReplaced: this.countMarkers(chain.template),
        processingTime,
        cacheHit: false,
        version: chain.metadata.chainVersion,
      },
    };
  }

  /**
   * Nettoie un texte SEO : supprime les marqueurs `#X#` orphelins, les
   * espaces redondants, les `<b></b>` vides. Tronque le titre à 60 chars.
   *
   * Conservé du V4 d'origine : la chaîne PR-2c produit déjà des templates
   * propres, mais on garde ce coup d'oil pour le legacy fallback (où certains
   * marqueurs synthétisés peuvent contenir des résidus).
   */
  private cleanContent(content: string, isTitle = false): string {
    let cleaned = content
      .replace(/#[A-Za-z_]+#/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.])/g, '$1')
      .replace(/<b>\s*<\/b>/g, '')
      .replace(/<b>\s+/g, '<b>')
      .replace(/\s+<\/b>/g, '</b>')
      .trim();

    if (isTitle) {
      cleaned = cleaned.replace(/<[^>]*>/g, '');
      if (cleaned.length > 60) cleaned = `${cleaned.substring(0, 57)}...`;
    }
    return cleaned;
  }

  private countMarkers(template: { content: string; title: string }): number {
    const all = `${template.title} ${template.content}`;
    return (all.match(/#[A-Za-z0-9_]+#/g) ?? []).length;
  }

  // ====================================
  // 🔧 DEFAULT / FALLBACK
  // ====================================

  private generateDefaultSeo(
    variables: SeoVariables,
    startTime: number,
  ): CompleteSeoResult {
    const processingTime = Date.now() - startTime;
    this.processingTimes.push(processingTime);

    const hasVehicleContext =
      variables.marque && variables.modele && variables.type;
    const hasGammeOnly = variables.gamme && !hasVehicleContext;

    if (!hasVehicleContext && !hasGammeOnly) {
      this.unknownPagesDetected.push({
        pgId: 0,
        typeId: 0,
        timestamp: new Date(),
      });
      this.logger.warn(
        '⚠️ [SEO V4] Page type "unknown" détectée — Contexte incomplet',
        {
          gamme: variables.gamme,
          marque: variables.marque,
          hasArticlesCount: variables.articlesCount > 0,
        },
      );
    }

    let title: string;
    let description: string;
    let h1: string;
    let preview: string;
    let content: string;

    if (hasVehicleContext) {
      title = variables.isTopGamme
        ? `${variables.gamme} Premium ${variables.marque} ${variables.modele} ${variables.type}`
        : `${variables.gamme} ${variables.marque} ${variables.modele} ${variables.type}`;
      description = `Découvrez notre sélection de ${variables.gamme.toLowerCase()} pour votre ${variables.marque} ${variables.modele} ${variables.type}. ${variables.articlesCount > 0 ? `${variables.articlesCount} références disponibles` : 'Large choix'} ${variables.minPrice ? `dès ${variables.minPrice}€` : 'aux meilleurs prix'}.`;
      h1 = `<b>${variables.gamme}</b> ${variables.marque} ${variables.modele} ${variables.type}`;
      preview = `${variables.gamme} ${variables.marque} - Qualité garantie`;
      content = `<p>Trouvez les meilleures <b>${variables.gamme.toLowerCase()}</b> pour votre <b>${variables.marque} ${variables.modele} ${variables.type}</b>. Nos experts sélectionnent pour vous des pièces de qualité ${variables.minPrice ? `à partir de ${variables.minPrice}€` : 'aux meilleurs prix'}.</p>`;
    } else if (hasGammeOnly) {
      title = `${variables.gamme} - Pièces auto de qualité | Automecanik`;
      description = `Large sélection de ${variables.gamme.toLowerCase()} pour toutes marques et modèles. ${variables.articlesCount > 0 ? `Plus de ${variables.articlesCount} références` : 'Catalogue complet'} ${variables.minPrice ? `à partir de ${variables.minPrice}€` : 'aux meilleurs prix'}. Livraison rapide.`;
      h1 = `<b>${variables.gamme}</b> pour tous véhicules`;
      preview = `${variables.gamme} - Catalogue complet`;
      content = `<p>Explorez notre gamme complète de <b>${variables.gamme.toLowerCase()}</b> pour tous types de véhicules. Qualité garantie, livraison rapide${variables.minPrice ? `, prix à partir de ${variables.minPrice}€` : ''}.</p>`;
    } else {
      title = `${variables.gamme || 'Pièces auto'} | Automecanik`;
      description = `Catalogue de pièces détachées auto de qualité. ${variables.articlesCount > 0 ? `${variables.articlesCount} produits disponibles` : 'Large choix'} pour toutes marques et modèles. Livraison rapide, prix compétitifs.`;
      h1 = `<b>${variables.gamme || 'Pièces détachées'}</b>`;
      preview = `${variables.gamme || 'Pièces auto'} - Qualité garantie`;
      content = `<p>Découvrez notre catalogue de <b>${variables.gamme ? variables.gamme.toLowerCase() : 'pièces détachées'}</b> pour tous types de véhicules. Qualité garantie, livraison rapide${variables.minPrice ? `, prix à partir de ${variables.minPrice}€` : ''}.</p>`;
    }

    return {
      title: this.cleanContent(title, true),
      description: this.cleanContent(description),
      h1,
      preview,
      content,
      keywords: this.generateKeywords(variables),
      metadata: {
        templatesUsed: hasVehicleContext
          ? ['default_fallback']
          : ['unknown_page_fallback'],
        switchesProcessed: 0,
        variablesReplaced: hasVehicleContext ? 8 : 3,
        processingTime,
        cacheHit: false,
        version: hasVehicleContext ? '4.1.0-fallback' : '4.1.0-unknown',
      },
    };
  }

  // ====================================
  // 🔧 UTILITIES
  // ====================================

  private generateKeywords(variables: SeoVariables): string {
    return [
      variables.gammeMeta,
      variables.marqueMeta,
      variables.modeleMeta,
      variables.typeMeta,
      `${variables.nbCh} ch`,
      variables.annee,
      variables.carosserie,
      variables.fuel,
      variables.codeMoteur,
    ]
      .filter(Boolean)
      .join(', ');
  }

  // ====================================
  // 🔧 CACHE MANAGEMENT
  // ====================================

  private getCacheTTL(variables: SeoVariables): number {
    if (variables.isTopGamme) return this.CACHE_TTL_LONG;
    if (variables.seoScore && variables.seoScore >= 80)
      return this.CACHE_TTL_MEDIUM;
    return this.CACHE_TTL_SHORT;
  }

  private getCachedData(key: string): CompleteSeoResult | null {
    const cached = this.seoCache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.cacheHits++;
      return cached.data;
    }
    this.cacheMisses++;
    return null;
  }

  private setCachedData(
    key: string,
    data: CompleteSeoResult,
    ttl: number,
  ): void {
    this.seoCache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  public clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.seoCache.entries()) {
      if (cached.expires <= now) this.seoCache.delete(key);
    }
  }

  public invalidateCache(): void {
    this.seoCache.clear();
    this.logger.log('🗑️ Cache SEO invalidé');
  }

  // ====================================
  // 📊 MONITORING PROXY (delegates to SeoV4MonitoringService)
  // ====================================

  private getMetricsStats() {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      processingTimes: this.processingTimes,
      unknownPagesDetected: this.unknownPagesDetected,
    };
  }

  async auditSeoQuality(): Promise<SeoAuditReport> {
    return this.monitoring.auditSeoQuality();
  }

  async getMetrics(): Promise<SeoMetrics> {
    return this.monitoring.getMetrics(this.getMetricsStats());
  }

  async generateAbTestVariants(
    pgId: number,
    typeId: number,
    variables: SeoVariables,
  ): Promise<SeoAbTestVariant[]> {
    return this.monitoring.generateAbTestVariants(pgId, typeId, variables);
  }

  async selectWinningVariant(
    variants: SeoAbTestVariant[],
  ): Promise<SeoAbTestVariant | null> {
    return this.monitoring.selectWinningVariant(variants);
  }

  async trackInternalLinkPerformance(
    linkType: 'LinkGammeCar' | 'LinkGammeCar_ID' | 'CompSwitch',
  ): Promise<InternalLinkMetrics> {
    return this.monitoring.trackInternalLinkPerformance(linkType);
  }

  async getCompleteMetricsReport() {
    return this.monitoring.getCompleteMetricsReport(this.getMetricsStats());
  }
}
