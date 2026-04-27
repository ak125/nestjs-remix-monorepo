/**
 * 🎯 DYNAMIC SEO SERVICE V4 ULTIMATE
 *
 * Core orchestration service for SEO generation.
 * Delegates switch processing to SeoV4SwitchEngineService
 * and monitoring/analytics to SeoV4MonitoringService.
 *
 * @version 4.0.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { SeoV4SwitchEngineService } from './services/seo-v4-switch-engine.service';
import { SeoV4MonitoringService } from './services/seo-v4-monitoring.service';
import {
  SeoVariablesSchema,
  SeoVariables,
  CompleteSeoResult,
  SeoAuditReport,
  SeoMetrics,
  SeoAbTestVariant,
  InternalLinkMetrics,
  PRIX_PAS_CHER,
  VOUS_PROPOSE,
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

  // Cache for complete SEO results
  private seoCache = new Map<
    string,
    { data: CompleteSeoResult; expires: number }
  >();
  private readonly CACHE_TTL_SHORT = 300000; // 5 min
  private readonly CACHE_TTL_MEDIUM = 900000; // 15 min
  private readonly CACHE_TTL_LONG = 3600000; // 1 heure

  // Metrics tracking state
  private cacheHits = 0;
  private cacheMisses = 0;
  private processingTimes: number[] = [];
  private unknownPagesDetected: Array<{
    pgId: number;
    typeId: number;
    timestamp: Date;
  }> = [];

  constructor(
    private readonly switchEngine: SeoV4SwitchEngineService,
    private readonly monitoring: SeoV4MonitoringService,
  ) {
    super();
  }

  // ====================================
  // 🎯 MAIN ENTRY POINT
  // ====================================

  async generateCompleteSeo(
    pgId: number,
    typeId: number,
    variables: SeoVariables,
  ): Promise<CompleteSeoResult> {
    const startTime = Date.now();
    const validatedVars = SeoVariablesSchema.parse(variables);

    this.logger.log(
      `🎯 [SEO V4] Génération complète: pgId=${pgId}, typeId=${typeId}`,
    );

    try {
      // PHASE 1: CACHE CHECK
      const cacheKey = `seo:complete:${pgId}:${typeId}:${JSON.stringify(validatedVars)}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        this.logger.debug(`📦 [CACHE HIT] SEO complet`);
        return {
          ...cached,
          metadata: { ...cached.metadata, cacheHit: true },
        };
      }

      // PHASE 2: PARALLEL DATA FETCH
      const [seoTemplate, itemSwitches, gammeSwitches, familySwitches] =
        await Promise.all([
          this.getSeoTemplate(pgId),
          this.getItemSwitches(pgId),
          this.getGammeCarSwitches(pgId),
          this.getFamilySwitches(validatedVars.mfId, pgId),
        ]);

      if (!seoTemplate) {
        return this.generateDefaultSeo(validatedVars, startTime);
      }

      // PHASE 3: PARALLEL SECTION PROCESSING
      const [title, description, h1, preview, content] = await Promise.all([
        this.processTitle(
          seoTemplate.sgc_title,
          validatedVars,
          itemSwitches,
          gammeSwitches,
          typeId,
          pgId,
        ),
        this.processDescription(
          seoTemplate.sgc_descrip,
          validatedVars,
          itemSwitches,
          gammeSwitches,
          typeId,
          pgId,
        ),
        this.processH1(seoTemplate.sgc_h1, validatedVars),
        this.processPreview(seoTemplate.sgc_preview, validatedVars),
        this.processContent(
          seoTemplate.sgc_content,
          validatedVars,
          itemSwitches,
          gammeSwitches,
          familySwitches,
          typeId,
        ),
      ]);

      // PHASE 4: KEYWORDS + METADATA
      const keywords = this.generateKeywords(validatedVars);
      const processingTime = Date.now() - startTime;

      const result: CompleteSeoResult = {
        title,
        description,
        h1,
        preview,
        content,
        keywords,
        metadata: {
          templatesUsed: [seoTemplate.sgc_id?.toString() || 'default'],
          switchesProcessed:
            itemSwitches.length + gammeSwitches.length + familySwitches.length,
          variablesReplaced: this.countVariablesInTemplate(seoTemplate),
          processingTime,
          cacheHit: false,
          version: '4.0.0',
        },
      };

      // PHASE 5: CACHE RESULT
      this.setCachedData(cacheKey, result, this.getCacheTTL(validatedVars));

      this.logger.log(`✅ [SEO V4] Succès en ${processingTime}ms`);
      return result;
    } catch (error) {
      this.logger.error(`❌ [SEO V4] Erreur:`, error);
      return this.generateDefaultSeo(validatedVars, startTime);
    }
  }

  // ====================================
  // 🎯 SECTION PROCESSORS
  // ====================================

  private async processTitle(
    template: string,
    variables: SeoVariables,
    itemSwitches: Record<string, unknown>[],
    gammeSwitches: Record<string, unknown>[],
    typeId: number,
    pgId: number,
  ): Promise<string> {
    let processed = template;

    processed = this.replaceStandardVariables(processed, variables, true);

    if (variables.minPrice) {
      processed = processed.replace(
        /#MinPrice#/g,
        `dès ${variables.minPrice}€`,
      );
    }

    const prixIndex = ((pgId % 100) + 1 + typeId) % PRIX_PAS_CHER.length;
    processed = processed.replace(/#PrixPasCher#/g, PRIX_PAS_CHER[prixIndex]);

    processed = await this.switchEngine.processCompSwitch(processed);

    if (variables.articlesCount > 0) {
      processed = processed.replace(
        /#ArticlesCount#/g,
        variables.articlesCount.toString(),
      );
    }

    return this.cleanContent(processed, true);
  }

  private async processDescription(
    template: string,
    variables: SeoVariables,
    itemSwitches: Record<string, unknown>[],
    gammeSwitches: any[],
    typeId: number,
    pgId: number,
  ): Promise<string> {
    let processed = template;

    processed = this.replaceStandardVariables(processed, variables, true);

    if (variables.minPrice) {
      processed = processed.replace(
        /#MinPrice#/g,
        `à partir de ${variables.minPrice}€`,
      );
    }

    const prixIndex = ((pgId % 100) + typeId) % PRIX_PAS_CHER.length;
    processed = processed.replace(/#PrixPasCher#/g, PRIX_PAS_CHER[prixIndex]);

    processed = await this.switchEngine.processCompSwitch(processed);

    // CompSwitch_3_PG_ID spécifique
    const switch3Regex = new RegExp(`#CompSwitch_3_${pgId}#`, 'g');
    if (switch3Regex.test(processed)) {
      const switch3 = gammeSwitches.filter((s) => s.sgcs_alias === 3);
      if (switch3.length > 0) {
        const index = (typeId + pgId + 3) % switch3.length;
        processed = processed.replace(
          switch3Regex,
          switch3[index].sgcs_content || '',
        );
      }
    }

    processed = await this.switchEngine.processLinkGammeCar(processed);

    return this.cleanContent(processed);
  }

  private async processH1(
    template: string,
    variables: SeoVariables,
  ): Promise<string> {
    let processed = template;
    processed = this.replaceStandardVariables(processed, variables, false);

    if (variables.articlesCount > 0) {
      processed = processed.replace(
        /#ArticlesCountFormatted#/g,
        `<b>${variables.articlesCount}</b> références`,
      );
    }

    return this.cleanContent(processed);
  }

  private async processPreview(
    template: string,
    variables: SeoVariables,
  ): Promise<string> {
    let processed = template;
    processed = this.replaceStandardVariables(processed, variables, true);

    if (variables.minPrice) {
      processed = processed.replace(
        /#MinPriceFormatted#/g,
        `${variables.minPrice}€`,
      );
    }

    processed = await this.switchEngine.processGammeSwitches(processed);

    return this.cleanContent(processed);
  }

  private async processContent(
    template: string,
    variables: SeoVariables,
    itemSwitches: Record<string, unknown>[],
    gammeSwitches: Record<string, unknown>[],
    familySwitches: Record<string, unknown>[],
    typeId: number,
  ): Promise<string> {
    let processed = template;

    processed = this.replaceStandardVariables(processed, variables, false);

    const prixIndex = typeId % PRIX_PAS_CHER.length;
    processed = processed.replace(/#PrixPasCher#/g, PRIX_PAS_CHER[prixIndex]);

    const proposeIndex = typeId % VOUS_PROPOSE.length;
    processed = processed.replace(/#VousPropose#/g, VOUS_PROPOSE[proposeIndex]);

    processed = await this.switchEngine.processExternalSwitchesEnhanced(
      processed,
      typeId,
    );
    processed =
      await this.switchEngine.processFamilySwitchesEnhanced(processed);
    processed = await this.switchEngine.processAllLinksEnhanced(processed);

    processed = this.processContextualVariables(processed, variables);

    return this.cleanContent(processed);
  }

  // ====================================
  // 🔧 VARIABLE REPLACEMENT
  // ====================================

  private replaceStandardVariables(
    content: string,
    variables: SeoVariables,
    useMeta: boolean,
  ): string {
    const replacements = {
      '#Gamme#': useMeta ? variables.gammeMeta : `<b>${variables.gamme}</b>`,
      '#VMarque#': useMeta
        ? variables.marqueMetaTitle
        : `<b>${variables.marque}</b>`,
      '#VModele#': useMeta
        ? variables.modeleMeta
        : `<b>${variables.modele}</b>`,
      '#VType#': useMeta ? variables.typeMeta : `<b>${variables.type}</b>`,
      '#VAnnee#': useMeta ? variables.annee : `<b>${variables.annee}</b>`,
      '#VNbCh#': useMeta
        ? variables.nbCh.toString()
        : `<b>${variables.nbCh} ch</b>`,
      '#VCarosserie#': `<b>${variables.carosserie}</b>`,
      '#VMotorisation#': `<b>${variables.fuel}</b>`,
      '#VCodeMoteur#': `<b>${variables.codeMoteur}</b>`,
      '#GammeLevel#': `niveau ${variables.gammeLevel}`,
      '#IsTop#': variables.isTopGamme ? 'gamme premium' : '',
    };

    let processed = content;
    for (const [marker, replacement] of Object.entries(replacements)) {
      processed = processed.replace(new RegExp(marker, 'g'), replacement);
    }

    return processed;
  }

  private processContextualVariables(
    content: string,
    variables: SeoVariables,
  ): string {
    let processed = content;

    if (variables.articlesCount) {
      let countText = '';
      if (variables.articlesCount === 1) {
        countText = '1 référence';
      } else if (variables.articlesCount < 10) {
        countText = `${variables.articlesCount} références`;
      } else {
        countText = `plus de ${variables.articlesCount} références`;
      }

      processed = processed.replace(
        /#ArticlesCountFormatted#/g,
        `<b>${countText}</b>`,
      );
    }

    if (variables.seoScore) {
      if (variables.seoScore >= 80) {
        processed = processed.replace(
          /#QualityBadge#/g,
          '<b>Sélection Premium</b>',
        );
      } else if (variables.seoScore >= 60) {
        processed = processed.replace(
          /#QualityBadge#/g,
          '<b>Qualité Vérifiée</b>',
        );
      } else {
        processed = processed.replace(/#QualityBadge#/g, '');
      }
    }

    if (variables.familyName) {
      processed = processed.replace(
        /#FamilyContext#/g,
        `dans la catégorie <b>${variables.familyName}</b>`,
      );
    }

    return processed;
  }

  private cleanContent(content: string, isTitle: boolean = false): string {
    let cleaned = content
      // Supprimer les variables template non résolues (#Gamme#, #MinPrice#, etc.)
      .replace(/#[A-Za-z_]+#/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.])/g, '$1')
      .replace(/<b>\s*<\/b>/g, '')
      .replace(/<b>\s+/g, '<b>')
      .replace(/\s+<\/b>/g, '</b>')
      .trim();

    if (isTitle) {
      cleaned = cleaned.replace(/<[^>]*>/g, '');
      if (cleaned.length > 60) {
        cleaned = cleaned.substring(0, 57) + '...';
      }
    }

    return cleaned;
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
        `⚠️ [SEO V4] Page type "unknown" détectée - Contexte incomplet`,
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
        version: hasVehicleContext ? '4.0.0-fallback' : '4.0.0-unknown',
      },
    };
  }

  // ====================================
  // 📊 DATA ACCESS
  // ====================================

  private async getSeoTemplate(pgId: number): Promise<any> {
    const { data } = await this.supabase
      .from(TABLES.seo_gamme_car)
      .select('*')
      .eq('sgc_pg_id', pgId)
      .single();
    return data;
  }

  private async getItemSwitches(
    pgId: number,
  ): Promise<Record<string, unknown>[]> {
    const { data } = await this.supabase
      .from(TABLES.seo_item_switch)
      .select('*')
      .eq('sis_pg_id', pgId);
    return data || [];
  }

  private async getGammeCarSwitches(pgId: number): Promise<any[]> {
    const { data } = await this.supabase
      .from(TABLES.seo_gamme_car_switch)
      .select('*')
      .eq('sgcs_pg_id', pgId);
    return data || [];
  }

  private async getFamilySwitches(
    mfId: number | undefined,
    pgId: number,
  ): Promise<Record<string, unknown>[]> {
    if (!mfId) return [];
    const { data } = await this.supabase
      .from(TABLES.seo_family_gamme_car_switch)
      .select('*')
      .eq('sfgcs_mf_id', mfId)
      .eq('sfgcs_pg_id', pgId);
    return data || [];
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

  private countVariablesInTemplate(template: Record<string, unknown>): number {
    const content = JSON.stringify(template);
    const matches = content.match(/#[A-Za-z0-9_]+#/g);
    return matches ? matches.length : 0;
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
      if (cached.expires <= now) {
        this.seoCache.delete(key);
      }
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
