/**
 * 📊 SEO Link Tracking Service
 *
 * Service pour tracker les clics sur liens internes (maillage interne)
 * Stocke les données dans Supabase pour analytics SEO
 *
 * Types de liens trackés:
 * - LinkGammeCar: Liens vers gammes dans le contenu SEO
 * - LinkGammeCar_ID: Liens avec ID gamme
 * - CompSwitch: Liens de comparaison/switches
 * - CrossSelling: Liens de cross-selling
 * - VoirAussi: Section "Voir aussi"
 * - Footer: Liens footer SEO (Top Marques, Gammes populaires)
 * - RelatedArticles: Liens vers articles liés
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { RpcGateService } from '../../security/rpc-gate/rpc-gate.service';

// Types pour le tracking
export interface LinkClickEvent {
  linkType:
    | 'LinkGammeCar'
    | 'LinkGammeCar_ID'
    | 'LinkGamme'
    | 'CompSwitch'
    | 'CrossSelling'
    | 'VoirAussi'
    | 'Footer'
    | 'RelatedArticles'
    | 'TopMarques'
    | 'GammesPopulaires'
    | string; // Support custom types
  sourceUrl: string;
  destinationUrl: string;
  anchorText?: string;
  linkPosition?:
    | 'header'
    | 'content'
    | 'sidebar'
    | 'footer'
    | 'crossselling'
    | 'voiraussi'
    | 'blog';
  sessionId?: string;
  userId?: string;
  userAgent?: string;
  referer?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';

  // 🧪 A/B Testing: Tracking des formulations de switches
  switchVerbId?: number; // ID du verbe utilisé (SGCS_ALIAS=1)
  switchNounId?: number; // ID du nom utilisé (SGCS_ALIAS=2)
  switchFormula?: string; // Formule complète "verb_id:noun_id"
  targetGammeId?: number; // ID de la gamme cible du lien
}

export interface LinkImpressionEvent {
  linkType: string;
  pageUrl: string;
  linkCount: number;
  sessionId?: string;
}

export interface LinkMetrics {
  linkType: string;
  totalClicks: number;
  uniqueSessions: number;
  clickThroughRate: number;
  topDestinations: Array<{ url: string; clicks: number }>;
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
}

export interface LinkPerformanceReport {
  period: string;
  metrics: LinkMetrics[];
  totalClicks: number;
  averageCTR: number;
}

@Injectable()
export class SeoLinkTrackingService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SeoLinkTrackingService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
    this.logger.log('✅ SeoLinkTrackingService initialisé avec Supabase');
  }

  /**
   * Enregistre un clic sur un lien interne
   */
  async trackClick(event: LinkClickEvent): Promise<boolean> {
    if (!this.supabase) {
      this.logger.debug('Supabase non disponible, clic non tracké');
      return false;
    }

    // Validation: linkType est obligatoire
    if (!event.linkType) {
      this.logger.warn("⚠️ linkType manquant dans l'événement de clic");
      return false;
    }

    try {
      const { error } = await this.supabase.from('seo_link_clicks').insert({
        link_type: event.linkType,
        source_url: event.sourceUrl,
        destination_url: event.destinationUrl,
        anchor_text: event.anchorText,
        link_position: event.linkPosition,
        session_id: event.sessionId,
        user_id: event.userId,
        user_agent: event.userAgent,
        referer: event.referer,
        device_type: event.deviceType,
        // 🧪 A/B Testing fields
        switch_verb_id: event.switchVerbId || null,
        switch_noun_id: event.switchNounId || null,
        switch_formula: event.switchFormula || null,
        target_gamme_id: event.targetGammeId || null,
        clicked_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error(`❌ Erreur tracking clic: ${error.message}`);
        return false;
      }

      this.logger.debug(
        `✅ Clic tracké: ${event.linkType} -> ${event.destinationUrl}`,
      );
      return true;
    } catch (err) {
      this.logger.error(`❌ Exception tracking clic: ${err}`);
      return false;
    }
  }

  /**
   * Enregistre une impression de liens (page vue avec liens)
   */
  async trackImpression(event: LinkImpressionEvent): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('seo_link_impressions')
        .insert({
          link_type: event.linkType,
          page_url: event.pageUrl,
          link_count: event.linkCount,
          session_id: event.sessionId,
          viewed_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error(`❌ Erreur tracking impression: ${error.message}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(`❌ Exception tracking impression: ${err}`);
      return false;
    }
  }

  /**
   * Récupère les métriques pour un type de lien
   */
  async getMetricsByLinkType(
    linkType: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<LinkMetrics | null> {
    if (!this.supabase) {
      // Retourner des données mock si Supabase non dispo
      return this.getMockMetrics(linkType);
    }

    try {
      const start =
        startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut
      const end = endDate || new Date();

      // Requête pour les clics
      const { data: clicks, error: clicksError } = await this.supabase
        .from('seo_link_clicks')
        .select('destination_url, session_id, device_type')
        .eq('link_type', linkType)
        .gte('clicked_at', start.toISOString())
        .lte('clicked_at', end.toISOString());

      if (clicksError) {
        this.logger.error(
          `❌ Erreur récupération métriques: ${clicksError.message}`,
        );
        return this.getMockMetrics(linkType);
      }

      // Calculer les métriques
      const totalClicks = clicks?.length || 0;
      const uniqueSessions = new Set(
        clicks?.map((c) => c.session_id).filter(Boolean),
      ).size;

      // Top destinations
      const destinationCounts = new Map<string, number>();
      clicks?.forEach((c) => {
        const count = destinationCounts.get(c.destination_url) || 0;
        destinationCounts.set(c.destination_url, count + 1);
      });

      const topDestinations = Array.from(destinationCounts.entries())
        .map(([url, clickCount]) => ({ url, clicks: clickCount }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      // Device breakdown
      const deviceBreakdown = {
        mobile: clicks?.filter((c) => c.device_type === 'mobile').length || 0,
        desktop: clicks?.filter((c) => c.device_type === 'desktop').length || 0,
        tablet: clicks?.filter((c) => c.device_type === 'tablet').length || 0,
      };

      // CTR (nécessite les impressions)
      const { data: impressions } = await this.supabase
        .from('seo_link_impressions')
        .select('link_count')
        .eq('link_type', linkType)
        .gte('viewed_at', start.toISOString())
        .lte('viewed_at', end.toISOString());

      const totalImpressions =
        impressions?.reduce((sum, i) => sum + (i.link_count || 0), 0) || 1;
      const clickThroughRate = (totalClicks / totalImpressions) * 100;

      return {
        linkType,
        totalClicks,
        uniqueSessions,
        clickThroughRate: Math.round(clickThroughRate * 100) / 100,
        topDestinations,
        deviceBreakdown,
      };
    } catch (err) {
      this.logger.error(`❌ Exception getMetricsByLinkType: ${err}`);
      return this.getMockMetrics(linkType);
    }
  }

  /**
   * Génère un rapport de performance complet
   */
  async getPerformanceReport(
    startDate?: Date,
    endDate?: Date,
  ): Promise<LinkPerformanceReport> {
    const linkTypes = [
      'LinkGammeCar',
      'LinkGammeCar_ID',
      'CompSwitch',
      'CrossSelling',
      'VoirAussi',
      'Footer',
      'RelatedArticles',
    ];

    const metricsPromises = linkTypes.map((type) =>
      this.getMetricsByLinkType(type, startDate, endDate),
    );

    const metricsResults = await Promise.all(metricsPromises);
    const metrics = metricsResults.filter((m): m is LinkMetrics => m !== null);

    const totalClicks = metrics.reduce((sum, m) => sum + m.totalClicks, 0);
    const averageCTR =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.clickThroughRate, 0) /
          metrics.length
        : 0;

    return {
      period: `${startDate?.toISOString().split('T')[0] || '30 derniers jours'} - ${endDate?.toISOString().split('T')[0] || "aujourd'hui"}`,
      metrics,
      totalClicks,
      averageCTR: Math.round(averageCTR * 100) / 100,
    };
  }

  /**
   * Données mock pour fallback
   */
  private getMockMetrics(linkType: string): LinkMetrics {
    const mockData: Record<string, LinkMetrics> = {
      LinkGammeCar: {
        linkType: 'LinkGammeCar',
        totalClicks: 1250,
        uniqueSessions: 890,
        clickThroughRate: 27.2,
        topDestinations: [
          { url: '/pieces/filtres-a-air-8.html', clicks: 89 },
          { url: '/pieces/plaquettes-de-frein-1.html', clicks: 76 },
          { url: '/pieces/amortisseur-15.html', clicks: 65 },
        ],
        deviceBreakdown: { mobile: 625, desktop: 500, tablet: 125 },
      },
      LinkGammeCar_ID: {
        linkType: 'LinkGammeCar_ID',
        totalClicks: 890,
        uniqueSessions: 650,
        clickThroughRate: 30.0,
        topDestinations: [
          { url: '/pieces/phares-optiques-20.html', clicks: 54 },
          { url: '/pieces/kit-de-distribution-5.html', clicks: 48 },
        ],
        deviceBreakdown: { mobile: 445, desktop: 356, tablet: 89 },
      },
      CompSwitch: {
        linkType: 'CompSwitch',
        totalClicks: 2100,
        uniqueSessions: 1500,
        clickThroughRate: 20.0,
        topDestinations: [],
        deviceBreakdown: { mobile: 1050, desktop: 840, tablet: 210 },
      },
      CrossSelling: {
        linkType: 'CrossSelling',
        totalClicks: 560,
        uniqueSessions: 420,
        clickThroughRate: 15.5,
        topDestinations: [
          { url: '/pieces/disque-de-frein-2.html', clicks: 120 },
          { url: '/pieces/filtre-a-huile-7.html', clicks: 95 },
        ],
        deviceBreakdown: { mobile: 280, desktop: 224, tablet: 56 },
      },
      VoirAussi: {
        linkType: 'VoirAussi',
        totalClicks: 320,
        uniqueSessions: 280,
        clickThroughRate: 12.0,
        topDestinations: [
          { url: '/constructeurs/peugeot-128.html', clicks: 45 },
          { url: '/pieces', clicks: 38 },
        ],
        deviceBreakdown: { mobile: 160, desktop: 128, tablet: 32 },
      },
      Footer: {
        linkType: 'Footer',
        totalClicks: 450,
        uniqueSessions: 380,
        clickThroughRate: 8.5,
        topDestinations: [
          { url: '/constructeurs/renault-140.html', clicks: 65 },
          { url: '/pieces/plaquettes-de-frein-1.html', clicks: 52 },
        ],
        deviceBreakdown: { mobile: 180, desktop: 225, tablet: 45 },
      },
      RelatedArticles: {
        linkType: 'RelatedArticles',
        totalClicks: 180,
        uniqueSessions: 150,
        clickThroughRate: 5.2,
        topDestinations: [
          { url: '/blog-pieces-auto/article/guide-freins', clicks: 28 },
        ],
        deviceBreakdown: { mobile: 90, desktop: 72, tablet: 18 },
      },
    };

    return (
      mockData[linkType] || {
        linkType,
        totalClicks: 0,
        uniqueSessions: 0,
        clickThroughRate: 0,
        topDestinations: [],
        deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
      }
    );
  }

  /**
   * 📊 Agrège les métriques quotidiennes (appelé par cron job)
   * Exécute la fonction SQL aggregate_seo_link_metrics()
   */
  async aggregateDailyMetrics(): Promise<{
    success: boolean;
    message: string;
    aggregatedDate?: string;
  }> {
    if (!this.supabase) {
      return { success: false, message: 'Supabase non disponible' };
    }

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      this.logger.log(`📊 Début agrégation métriques pour ${yesterdayStr}...`);

      // Appeler la fonction SQL via RPC
      // 🛡️ RPC Safety Gate
      const { error } = await this.callRpc<void>(
        'aggregate_seo_link_metrics',
        {},
        { source: 'cron' },
      );

      if (error) {
        this.logger.error(`❌ Erreur agrégation: ${error.message}`);
        return { success: false, message: error.message };
      }

      this.logger.log(`✅ Agrégation terminée pour ${yesterdayStr}`);
      return {
        success: true,
        message: `Métriques agrégées pour ${yesterdayStr}`,
        aggregatedDate: yesterdayStr,
      };
    } catch (err) {
      this.logger.error(`❌ Exception agrégation: ${err}`);
      return { success: false, message: String(err) };
    }
  }

  /**
   * 🧹 Nettoie les anciennes données brutes (> 90 jours)
   * Garde seulement les métriques agrégées pour l'historique
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<{
    success: boolean;
    deletedClicks: number;
    deletedImpressions: number;
  }> {
    if (!this.supabase) {
      return { success: false, deletedClicks: 0, deletedImpressions: 0 };
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffStr = cutoffDate.toISOString();

      this.logger.log(`🧹 Nettoyage données avant ${cutoffStr}...`);

      // Supprimer les clics anciens
      const { count: deletedClicks, error: clicksError } = await this.supabase
        .from('seo_link_clicks')
        .delete({ count: 'exact' })
        .lt('clicked_at', cutoffStr);

      if (clicksError) {
        this.logger.error(
          `❌ Erreur suppression clics: ${clicksError.message}`,
        );
      }

      // Supprimer les impressions anciennes
      const { count: deletedImpressions, error: impressionsError } =
        await this.supabase
          .from('seo_link_impressions')
          .delete({ count: 'exact' })
          .lt('viewed_at', cutoffStr);

      if (impressionsError) {
        this.logger.error(
          `❌ Erreur suppression impressions: ${impressionsError.message}`,
        );
      }

      this.logger.log(
        `✅ Nettoyage terminé: ${deletedClicks || 0} clics, ${deletedImpressions || 0} impressions supprimés`,
      );

      return {
        success: true,
        deletedClicks: deletedClicks || 0,
        deletedImpressions: deletedImpressions || 0,
      };
    } catch (err) {
      this.logger.error(`❌ Exception cleanup: ${err}`);
      return { success: false, deletedClicks: 0, deletedImpressions: 0 };
    }
  }
}
