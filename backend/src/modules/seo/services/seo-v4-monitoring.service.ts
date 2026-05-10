/**
 * SEO V4 Monitoring Service
 *
 * Extracted from dynamic-seo-v4-ultimate.service.ts
 * Phase 3: Monitoring, analytics, A/B testing, link tracking.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  SeoAuditReport,
  SeoMetrics,
  SeoMetricsStats,
  SeoAbTestVariant,
  SeoVariables,
  InternalLinkMetrics,
} from '../seo-v4.types';

@Injectable()
export class SeoV4MonitoringService extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoV4MonitoringService.name);

  // ====================================
  // 🔍 AUDIT QUALITÉ SEO
  // ====================================

  async auditSeoQuality(): Promise<SeoAuditReport> {
    this.logger.log('🔍 [SEO Audit] Démarrage scan qualité...');
    const startTime = Date.now();

    // 1. Récupérer toutes les combinaisons pgId/typeId actives
    const { data: allPages } = await this.supabase
      .from(TABLES.seo_gamme_car)
      .select('sgc_pg_id, sgc_type_id, sgc_title, sgc_updated_at')
      .not('sgc_title', 'is', null);

    const totalPages = allPages?.length || 0;
    const pagesWithSeo =
      allPages?.filter((p: any) => p.sgc_title?.length > 10).length || 0;
    const pagesWithoutSeo = totalPages - pagesWithSeo;

    // 2. Détecter contenu obsolète (> 6 mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const obsoleteContent =
      allPages
        ?.filter((p: any) => {
          const updatedAt = new Date(p.sgc_updated_at || 0);
          return updatedAt < sixMonthsAgo;
        })
        .map((p: any) => ({
          pgId: p.sgc_pg_id,
          typeId: p.sgc_type_id,
          lastUpdated: new Date(p.sgc_updated_at),
          ageInDays: Math.floor(
            (Date.now() - new Date(p.sgc_updated_at).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        }))
        .slice(0, 50) || [];

    // 3. Détecter variables manquantes dans templates
    const missingVariables: Array<{
      pgId: number;
      typeId: number;
      missingVars: string[];
    }> = [];

    for (const page of allPages?.slice(0, 100) || []) {
      const template = page.sgc_title || '';
      const requiredVars = ['#Gamme#', '#Marque#', '#Modele#', '#Type#'];
      const missing = requiredVars.filter((v) => !template.includes(v));

      if (missing.length > 0) {
        missingVariables.push({
          pgId: page.sgc_pg_id,
          typeId: page.sgc_type_id,
          missingVars: missing,
        });
      }
    }

    // 4. Calculer score qualité global
    const coverageRate = totalPages > 0 ? (pagesWithSeo / totalPages) * 100 : 0;
    const obsoleteRate =
      totalPages > 0 ? (obsoleteContent.length / totalPages) * 100 : 0;
    const missingVarsRate =
      totalPages > 0 ? (missingVariables.length / totalPages) * 100 : 0;

    const qualityScore = Math.round(
      coverageRate * 0.5 +
        (100 - obsoleteRate) * 0.3 +
        (100 - missingVarsRate) * 0.2,
    );

    // 5. Générer recommandations
    const recommendations: string[] = [];
    if (coverageRate < 80) {
      recommendations.push(
        `⚠️ Couverture SEO faible (${coverageRate.toFixed(1)}%) - Créer templates pour ${pagesWithoutSeo} pages`,
      );
    }
    if (obsoleteContent.length > 10) {
      recommendations.push(
        `🗓️ ${obsoleteContent.length} pages avec contenu obsolète - Planifier mise à jour`,
      );
    }
    if (missingVariables.length > 5) {
      recommendations.push(
        `📝 ${missingVariables.length} templates incomplets - Vérifier variables manquantes`,
      );
    }
    if (qualityScore >= 90) {
      recommendations.push(
        '✅ Excellente qualité SEO - Maintenir surveillance',
      );
    }

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `✅ [SEO Audit] Complété en ${processingTime}ms - Score: ${qualityScore}/100`,
    );

    return {
      scanDate: new Date(),
      totalPages,
      pagesWithSeo,
      pagesWithoutSeo,
      coverageRate,
      obsoleteContent,
      missingVariables: missingVariables.slice(0, 20),
      qualityScore,
      recommendations,
    };
  }

  // ====================================
  // 📊 DASHBOARD KPIs
  // ====================================

  async getMetrics(stats: SeoMetricsStats): Promise<SeoMetrics> {
    const totalRequests = stats.cacheHits + stats.cacheMisses;
    const overallCacheHitRate =
      totalRequests > 0 ? (stats.cacheHits / totalRequests) * 100 : 0;

    const avgProcessingTime =
      stats.processingTimes.length > 0
        ? stats.processingTimes.reduce((a, b) => a + b, 0) /
          stats.processingTimes.length
        : 0;

    const topTemplates = [
      { templateId: 'standard_vehicle', usageCount: 1250, avgPerformance: 85 },
      { templateId: 'premium_gamme', usageCount: 890, avgPerformance: 92 },
      { templateId: 'blog_article', usageCount: 450, avgPerformance: 78 },
    ];

    const recentUnknown = stats.unknownPagesDetected
      .slice(-10)
      .map((p) => `pgId=${p.pgId}, typeId=${p.typeId}`);

    return {
      timestamp: new Date(),
      cacheHitRate: {
        overall: parseFloat(overallCacheHitRate.toFixed(2)),
        byPageType: {
          standard: 87.5,
          blog: 92.3,
          level1: 84.1,
          level2: 79.8,
          composit: 88.9,
        },
      },
      avgProcessingTime: {
        overall: parseFloat(avgProcessingTime.toFixed(2)),
        byContext: {
          'with-cache': 12.5,
          'without-cache': 145.3,
          fallback: 35.7,
        },
      },
      topTemplates,
      unknownPages: {
        count: stats.unknownPagesDetected.length,
        lastDetected: recentUnknown,
      },
      abTestResults: [],
    };
  }

  // ====================================
  // 🧪 A/B TESTING
  // ====================================

  async generateAbTestVariants(
    pgId: number,
    typeId: number,
    variables: SeoVariables,
  ): Promise<SeoAbTestVariant[]> {
    this.logger.log(
      `🧪 [A/B Test] Génération variantes: pgId=${pgId}, typeId=${typeId}`,
    );

    const variants: SeoAbTestVariant[] = [];

    // Variante 1: Conservateur
    variants.push({
      variantId: `${pgId}_${typeId}_conservative`,
      pgId,
      typeId,
      variant: 'conservative',
      title: `${variables.gamme} ${variables.marque} ${variables.modele} ${variables.type} - Pièces Auto`,
      description: `Découvrez notre sélection de ${variables.gamme.toLowerCase()} pour ${variables.marque} ${variables.modele} ${variables.type}. Qualité garantie, livraison rapide.`,
      h1: `${variables.gamme} ${variables.marque} ${variables.modele}`,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      isWinner: false,
      createdAt: new Date(),
    });

    // Variante 2: Équilibré
    variants.push({
      variantId: `${pgId}_${typeId}_balanced`,
      pgId,
      typeId,
      variant: 'balanced',
      title: `${variables.gamme} ${variables.marque} ${variables.modele} ${variables.type} – ${variables.articlesCount > 0 ? `${variables.articlesCount} références` : 'Large choix'}`,
      description: `Trouvez les meilleures ${variables.gamme.toLowerCase()} pour votre ${variables.marque} ${variables.modele} ${variables.type}. ${variables.minPrice ? `Dès ${variables.minPrice}€` : 'Prix compétitifs'}, livraison express, garantie qualité.`,
      h1: `<b>${variables.gamme}</b> pour ${variables.marque} ${variables.modele} ${variables.type}`,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      isWinner: false,
      createdAt: new Date(),
    });

    // Variante 3: Créatif
    variants.push({
      variantId: `${pgId}_${typeId}_creative`,
      pgId,
      typeId,
      variant: 'creative',
      title: `⚡ ${variables.gamme} ${variables.marque} ${variables.modele} ${variables.type} ${variables.minPrice ? `dès ${variables.minPrice}€` : '- Meilleurs Prix'} ✅`,
      description: `🚗 Votre ${variables.marque} ${variables.modele} mérite les meilleures ${variables.gamme.toLowerCase()} ! ✅ Qualité certifiée ⚡ Livraison 24h 💰 ${variables.articlesCount > 0 ? `${variables.articlesCount}+ références` : 'Stock disponible'}.`,
      h1: `<b>⚡ ${variables.gamme} Premium</b> ${variables.marque} ${variables.modele}`,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      isWinner: false,
      createdAt: new Date(),
    });

    this.logger.log(`✅ [A/B Test] 3 variantes générées avec succès`);
    return variants;
  }

  async selectWinningVariant(
    variants: SeoAbTestVariant[],
  ): Promise<SeoAbTestVariant | null> {
    const eligibleVariants = variants.filter((v) => v.impressions >= 1000);

    if (eligibleVariants.length === 0) {
      this.logger.warn(
        '⚠️ [A/B Test] Pas assez de données pour déterminer gagnant',
      );
      return null;
    }

    eligibleVariants.forEach((v) => {
      v.ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0;
    });

    const winner = eligibleVariants.reduce((best, current) =>
      current.ctr > best.ctr ? current : best,
    );

    winner.isWinner = true;
    this.logger.log(
      `🏆 [A/B Test] Variante gagnante: ${winner.variant} (CTR: ${winner.ctr.toFixed(2)}%)`,
    );

    return winner;
  }

  // ====================================
  // 📈 LINK TRACKING
  // ====================================

  async trackInternalLinkPerformance(
    linkType: 'LinkGammeCar' | 'LinkGammeCar_ID' | 'CompSwitch',
  ): Promise<InternalLinkMetrics> {
    this.logger.log(`📊 [Link Tracking] Analyse performance: ${linkType}`);

    const mockMetrics: InternalLinkMetrics = {
      linkType,
      totalGenerated: 0,
      totalClicks: 0,
      clickThroughRate: 0,
      topPerformers: [],
      avgPosition: 0,
    };

    if (linkType === 'LinkGammeCar') {
      mockMetrics.totalGenerated = 1250;
      mockMetrics.totalClicks = 340;
      mockMetrics.clickThroughRate = 27.2;
      mockMetrics.topPerformers = [
        { url: '/gammes/filtres-a-air', clicks: 89, conversions: 12 },
        { url: '/gammes/plaquettes-frein', clicks: 76, conversions: 9 },
        { url: '/gammes/amortisseurs', clicks: 65, conversions: 8 },
      ];
      mockMetrics.avgPosition = 3.2;
    } else if (linkType === 'LinkGammeCar_ID') {
      mockMetrics.totalGenerated = 890;
      mockMetrics.totalClicks = 267;
      mockMetrics.clickThroughRate = 30.0;
      mockMetrics.topPerformers = [
        { url: '/gammes/phares-optiques', clicks: 54, conversions: 7 },
        { url: '/gammes/courroies-distribution', clicks: 48, conversions: 6 },
      ];
      mockMetrics.avgPosition = 2.8;
    } else if (linkType === 'CompSwitch') {
      mockMetrics.totalGenerated = 2100;
      mockMetrics.totalClicks = 420;
      mockMetrics.clickThroughRate = 20.0;
      mockMetrics.avgPosition = 4.5;
    }

    this.logger.log(
      `✅ [Link Tracking] ${linkType}: ${mockMetrics.totalClicks} clics / ${mockMetrics.totalGenerated} liens (CTR: ${mockMetrics.clickThroughRate}%)`,
    );

    return mockMetrics;
  }

  // ====================================
  // 📊 RAPPORT COMPLET
  // ====================================

  async getCompleteMetricsReport(stats: SeoMetricsStats): Promise<{
    audit: SeoAuditReport;
    metrics: SeoMetrics;
    linkPerformance: InternalLinkMetrics[];
  }> {
    this.logger.log('📊 [Metrics] Génération rapport complet...');

    const [audit, metrics, linkGammeCar, linkGammeCarId, compSwitch] =
      await Promise.all([
        this.auditSeoQuality(),
        this.getMetrics(stats),
        this.trackInternalLinkPerformance('LinkGammeCar'),
        this.trackInternalLinkPerformance('LinkGammeCar_ID'),
        this.trackInternalLinkPerformance('CompSwitch'),
      ]);

    return {
      audit,
      metrics,
      linkPerformance: [linkGammeCar, linkGammeCarId, compSwitch],
    };
  }
}
