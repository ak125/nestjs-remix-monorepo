import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { DatabaseException, ErrorCodes } from '../../common/exceptions';
import { MetaTagsArianeDataService } from '../../database/services/meta-tags-ariane-data.service';

@Injectable()
export class DashboardService extends SupabaseBaseService {
  protected readonly logger = new Logger(DashboardService.name);

  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly metaTagsData: MetaTagsArianeDataService,
  ) {
    super(configService);
  }

  /**
   * 📊 Statistiques complètes du dashboard avec intégration SEO et cache Redis
   */
  async getAllStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    totalSuppliers: number;
    totalProducts: number;
    activeProducts: number;
    totalCategories: number;
    conversionRate: number;
    avgOrderValue: number;
    seoStats: {
      totalPages: number;
      pagesWithSeo: number;
      sitemapEntries: number;
      completionRate: number;
      organicTraffic: number | null;
      keywordRankings: number | null;
    };
  }> {
    const startTime = Date.now();
    try {
      this.logger.log('🔄 Starting getAllStats with cache integration');

      // Utiliser le cache avec le pattern getOrSet
      const cachedStats = await this.cacheService.getOrSet(
        'dashboard:stats:all',
        async () => {
          this.logger.log(
            '🚀 Cache MISS - Fetching fresh dashboard statistics with SEO',
          );

          // Récupérer toutes les statistiques en parallèle
          const [
            usersStats,
            ordersStats,
            suppliersStats,
            productsStats,
            seoStats,
          ] = await Promise.all([
            this.getUsersStats(),
            this.getOrdersStats(),
            this.getSuppliersStats(),
            this.getProductsStats(),
            this.getSeoStats(),
          ]);

          // Calculer les métriques dérivées
          const conversionRate =
            ordersStats.totalOrders > 0
              ? parseFloat(
                  (
                    (ordersStats.completedOrders / ordersStats.totalOrders) *
                    100
                  ).toFixed(1),
                )
              : 0;

          const avgOrderValue =
            ordersStats.completedOrders > 0
              ? parseFloat(
                  (
                    ordersStats.totalRevenue / ordersStats.completedOrders
                  ).toFixed(2),
                )
              : 0;

          const completeStats = {
            ...usersStats,
            ...ordersStats,
            ...suppliersStats,
            ...productsStats,
            conversionRate,
            avgOrderValue,
            seoStats: {
              ...seoStats,
              organicTraffic: null,
              keywordRankings: null,
            },
          };

          this.logger.log('✅ Fresh statistics fetched and cached');
          return completeStats;
        },
      );

      const performanceTime = Date.now() - startTime;
      this.logger.log(
        `✅ getAllStats completed in ${performanceTime}ms (cache hit: ${performanceTime < 100 ? 'YES' : 'NO'})`,
      );

      return cachedStats;
    } catch (error) {
      const performanceTime = Date.now() - startTime;
      this.logger.error(
        `❌ Error in getAllStats after ${performanceTime}ms:`,
        error,
      );

      // Retourner des valeurs par défaut en cas d'erreur
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        totalSuppliers: 0,
        totalProducts: 0,
        activeProducts: 0,
        totalCategories: 0,
        conversionRate: 0,
        avgOrderValue: 0,
        seoStats: {
          totalPages: 0,
          pagesWithSeo: 0,
          sitemapEntries: 0,
          completionRate: 0,
          organicTraffic: null,
          keywordRankings: null,
        },
      };
    }
  }

  /**
   * 🔍 Statistiques SEO Enterprise avec vraies tables de production
   */
  async getSeoStats(): Promise<{
    totalPages: number;
    pagesWithSeo: number;
    sitemapEntries: number;
    completionRate: number;
  }> {
    try {
      this.logger.log('📈 Fetching real SEO statistics from production tables');

      // 1. Comptage de la table principale __sitemap_p_link (714,336 entrées)
      const { count: sitemapEntries, error: sitemapError } = await this.supabase
        .from(TABLES.sitemap_p_link)
        .select('*', { count: 'exact', head: true });

      if (sitemapError) {
        this.logger.error('❌ Error counting sitemap entries:', sitemapError);
        throw sitemapError;
      }

      // 2. Comptage des articles de blog (__blog_advice)
      const { count: blogEntries, error: blogError } = await this.supabase
        .from(TABLES.blog_advice)
        .select('*', { count: 'exact', head: true });

      if (blogError) {
        this.logger.error('❌ Error counting blog entries:', blogError);
      }

      // 3. Comptage des pages gamme (__seo_gamme)
      const { count: gammeEntries, error: gammeError } = await this.supabase
        .from('__seo_gamme')
        .select('*', { count: 'exact', head: true });

      if (gammeError) {
        this.logger.error('❌ Error counting gamme entries:', gammeError);
      }

      // Calculer les statistiques réelles
      const totalSitemapEntries = sitemapEntries || 0;
      const totalBlogEntries = blogEntries || 0;
      const totalGammeEntries = gammeEntries || 0;
      const totalPages =
        totalSitemapEntries + totalBlogEntries + totalGammeEntries;

      // pagesWithSeo = pages sitemap (toutes ont des meta SEO generees)
      const pagesWithSeo = totalSitemapEntries;
      const completionRate =
        totalPages > 0
          ? parseFloat(((pagesWithSeo / totalPages) * 100).toFixed(1))
          : 0;

      const stats = {
        totalPages,
        pagesWithSeo,
        sitemapEntries: totalSitemapEntries,
        completionRate,
      };

      this.logger.log('📊 Real SEO statistics calculated:', stats);
      return stats;
    } catch (error) {
      this.logger.error('❌ Error in getSeoStats:', error);
      return {
        totalPages: 0,
        pagesWithSeo: 0,
        sitemapEntries: 0,
        completionRate: 0,
      };
    }
  }

  /**
   * 📊 Statistiques des commandes - Méthode existante optimisée préservée
   */
  async getOrdersStats(): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalRevenue: number;
  }> {
    try {
      this.logger.log('Fetching orders statistics from ___xtr_order');

      // Récupérer le total des commandes
      const { count: totalOrders, error: countError } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.error('Error counting orders:', countError);
        throw countError;
      }

      // Récupérer les statistiques détaillées
      const { data: ordersData, error: dataError } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_is_pay, ord_total_ttc');

      if (dataError) {
        this.logger.error('Error fetching orders data:', dataError);
        throw dataError;
      }

      const completedOrders =
        ordersData?.filter((order) => order.ord_is_pay === '1').length || 0;

      const pendingOrders = (totalOrders || 0) - completedOrders;

      const totalRevenue =
        ordersData?.reduce((sum, order) => {
          if (order.ord_is_pay === '1') {
            return sum + parseFloat(order.ord_total_ttc || '0');
          }
          return sum;
        }, 0) || 0;

      const stats = {
        totalOrders: totalOrders || 0,
        completedOrders,
        pendingOrders,
        totalRevenue,
      };

      this.logger.log('Orders statistics:', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error in getOrdersStats:', error);
      return {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
      };
    }
  }

  /**
   * 👥 Statistiques des utilisateurs - Méthode existante préservée
   */
  async getUsersStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
  }> {
    try {
      this.logger.log('Fetching users statistics');

      const { count: totalUsers, error: totalError } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        this.logger.error('Error counting users:', totalError);
        throw totalError;
      }

      const { count: activeUsers, error: activeError } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*', { count: 'exact', head: true })
        .eq('cst_activ', '1');

      if (activeError) {
        this.logger.error('Error counting active users:', activeError);
        throw activeError;
      }

      const stats = {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
      };

      this.logger.log('Users statistics:', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error in getUsersStats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
      };
    }
  }

  /**
   * 🏭 Statistiques des fournisseurs - Count actifs depuis pieces_marque (pm_display 1/2/5)
   */
  async getSuppliersStats(): Promise<{ totalSuppliers: number }> {
    try {
      this.logger.log('Fetching suppliers statistics from pieces_marque');

      const { count: totalSuppliers, error } = await this.supabase
        .from(TABLES.pieces_marque)
        .select('*', { count: 'exact', head: true })
        .in('pm_display', ['1', '2', '5']);

      if (error) {
        this.logger.error('Error counting suppliers:', error);
        throw error;
      }

      const stats = { totalSuppliers: totalSuppliers || 0 };
      this.logger.log('Suppliers statistics:', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error in getSuppliersStats:', error);
      return { totalSuppliers: 0 };
    }
  }

  /**
   * 📦 Statistiques des produits - NOUVELLE MÉTHODE
   */
  async getProductsStats(): Promise<{
    totalProducts: number;
    activeProducts: number;
    totalCategories: number;
  }> {
    try {
      this.logger.log('Fetching products statistics');

      const { count: totalProducts, error: totalError } = await this.supabase
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        this.logger.error('Error counting products:', totalError);
        throw totalError;
      }

      const { count: activeProducts, error: activeError } = await this.supabase
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true);

      if (activeError) {
        this.logger.error('Error counting active products:', activeError);
      }

      const { count: totalCategories, error: catError } = await this.supabase
        .from(TABLES.catalog_family)
        .select('*', { count: 'exact', head: true });

      if (catError) {
        this.logger.error('Error counting categories:', catError);
      }

      const stats = {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        totalCategories: totalCategories || 0,
      };

      this.logger.log('Products statistics:', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error in getProductsStats:', error);
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalCategories: 0,
      };
    }
  }

  /**
   * 🎯 Dashboard modulaire - Fonctionnalité nouvelle combinée avec existant
   */
  async getDashboardData(module: string, userId: string) {
    try {
      this.logger.log(
        `Fetching dashboard data for module: ${module}, user: ${userId}`,
      );

      let moduleData = {};

      switch (module) {
        case 'commercial':
          moduleData = await this.getCommercialDashboard(userId);
          break;
        case 'expedition':
          moduleData = await this.getExpeditionDashboard(userId);
          break;
        case 'seo':
          moduleData = await this.getSeoDashboard(userId);
          break;
        case 'staff':
          moduleData = await this.getStaffDashboard(userId);
          break;
        default:
          moduleData = { error: `Module ${module} not supported` };
      }

      return {
        module,
        data: moduleData,
        timestamp: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Error in getDashboardData for module ${module}:`,
        error,
      );
      return {
        module,
        data: {},
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 📊 Dashboard commercial - Utilise les méthodes existantes optimisées
   */
  async getCommercialDashboard(userId: string) {
    try {
      this.logger.log(`Fetching commercial dashboard for user: ${userId}`);

      // Utiliser les méthodes existantes qui fonctionnent déjà
      const [orders, users, suppliers] = await Promise.all([
        this.getOrdersStats(),
        this.getUsersStats(),
        this.getSuppliersStats(),
      ]);

      return {
        module: 'commercial',
        widgets: {
          orders,
          users,
          suppliers,
        },
        lastUpdate: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      this.logger.error('Error in getCommercialDashboard:', error);
      return {
        module: 'commercial',
        widgets: {},
        lastUpdate: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 🚚 Dashboard expédition - Nouvelles fonctionnalités avec tables existantes
   */
  async getExpeditionDashboard(userId: string) {
    try {
      this.logger.log(`Fetching expedition dashboard for user: ${userId}`);

      // Utiliser directement les comptages sur ___xtr_order
      const [pending, inProgress, shipped] = await Promise.all([
        this.countOrdersByStatus(['2']), // En attente
        this.countOrdersByStatus(['3', '4']), // En préparation, prêt
        this.countOrdersByStatus(['5']), // Expédié
      ]);

      return {
        module: 'expedition',
        widgets: {
          pending: { count: pending, status: 'pending' },
          inProgress: { count: inProgress, status: 'inProgress' },
          shipped: { count: shipped, status: 'shipped' },
        },
        lastUpdate: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      this.logger.error('Error in getExpeditionDashboard:', error);
      return {
        module: 'expedition',
        widgets: {},
        lastUpdate: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 🎯 Dashboard SEO - Utilise tables méta existantes
   */
  async getSeoDashboard(userId: string) {
    try {
      this.logger.log(`Fetching SEO dashboard for user: ${userId}`);

      // Utiliser les tables META existantes
      const totalPages = await this.metaTagsData.countTotal();
      const optimizedPages = await this.metaTagsData.countOptimized();

      return {
        module: 'seo',
        widgets: {
          pages: {
            total: totalPages || 0,
            optimized: optimizedPages || 0,
            percentage: totalPages
              ? Math.round(((optimizedPages || 0) / totalPages) * 100)
              : 0,
          },
          rankings: {
            keywords_tracked: 150,
            top_10: 45,
            source: 'simulated',
          },
        },
        lastUpdate: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      this.logger.error('Error in getSeoDashboard:', error);
      return {
        module: 'seo',
        widgets: {},
        lastUpdate: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 👥 Dashboard Staff
   */
  async getStaffDashboard(userId: string) {
    try {
      this.logger.log(`Fetching staff dashboard for user: ${userId}`);

      // Réutiliser getUsersStats pour les stats staff
      const usersStats = await this.getUsersStats();

      return {
        module: 'staff',
        widgets: {
          members: {
            active: usersStats.activeUsers,
            total: usersStats.totalUsers,
          },
          permissions: {
            modules: 4,
            total_rules: 0,
          },
        },
        lastUpdate: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      this.logger.error('Error in getStaffDashboard:', error);
      return {
        module: 'staff',
        widgets: {},
        lastUpdate: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper method pour compter les commandes par statut
   */
  private async countOrdersByStatus(statuses: string[]): Promise<number> {
    try {
      const { count } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true })
        .in('ord_ords_id', statuses);

      return count || 0;
    } catch (error) {
      this.logger.error('Error counting orders by status:', error);
      return 0;
    }
  }

  /**
   * Test endpoint pour valider le service modernisé
   */
  async getTestData(): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
    version: string;
  }> {
    return {
      success: true,
      message:
        'DashboardService modernized - Architecture existante préservée + Flexibilité modulaire ajoutée',
      version: '2.0 - Vérifier Existant et Utiliser le Meilleur',
      timestamp: new Date().toISOString(),
    };
  }

  // ===== NOUVELLES MÉTHODES MODERNES "FIXED" - MEILLEURE APPROCHE =====

  async getUserCountFixed(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*', { count: 'exact', head: true });

      if (error) {
        this.logger.error(`Erreur getUserCountFixed: ${error.message}`);
        throw new DatabaseException({
          code: ErrorCodes.DASHBOARD.STATS_FAILED,
          message: `Impossible de récupérer le nombre d'utilisateurs: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      return count || 0;
    } catch (error) {
      this.logger.error('Erreur getUserCountFixed:', error);
      return 0;
    }
  }

  async getOrderCountFixed(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true });

      if (error) {
        this.logger.error(`Erreur getOrderCountFixed: ${error.message}`);
        throw new DatabaseException({
          code: ErrorCodes.DASHBOARD.STATS_FAILED,
          message: `Impossible de récupérer le nombre de commandes: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      return count || 0;
    } catch (error) {
      this.logger.error('Erreur getOrderCountFixed:', error);
      return 0;
    }
  }

  async getSupplierCountFixed(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(TABLES.xtr_supplier_link_pm)
        .select('*', { count: 'exact', head: true });

      if (error) {
        this.logger.error(`Erreur getSupplierCountFixed: ${error.message}`);
        throw new DatabaseException({
          code: ErrorCodes.DASHBOARD.STATS_FAILED,
          message: `Impossible de récupérer le nombre de fournisseurs: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      return count || 0;
    } catch (error) {
      this.logger.error('Erreur getSupplierCountFixed:', error);
      return 0;
    }
  }

  async getRecentOrdersCountFixed(): Promise<number> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact', head: true })
        .gte('ord_date', oneWeekAgo.toISOString());

      if (error) {
        this.logger.error(`Erreur getRecentOrdersCountFixed: ${error.message}`);
        throw new DatabaseException({
          code: ErrorCodes.DASHBOARD.STATS_FAILED,
          message: `Impossible de récupérer les commandes récentes: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }

      return count || 0;
    } catch (error) {
      this.logger.error('Erreur getRecentOrdersCountFixed:', error);
      return 0;
    }
  }

  /**
   * 📋 Récupérer les commandes récentes (méthode manquante)
   */
  async getRecentOrders(limit: number = 10): Promise<any[]> {
    try {
      this.logger.log(`Fetching ${limit} recent orders`);

      const { data, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select(
          `
          ord_id,
          ord_total_ttc,
          ord_ords_id,
          ord_is_pay,
          ord_date,
          ord_cst_id
        `,
        )
        .order('ord_date', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Error fetching recent orders:', error);
        throw error;
      }

      // Transformer les données pour un format plus lisible
      const transformedOrders =
        data?.map((order) => ({
          id: order.ord_id,
          total: parseFloat(order.ord_total_ttc || '0'),
          status: order.ord_ords_id,
          isPaid: order.ord_is_pay === '1',
          date: order.ord_date,
          customerId: order.ord_cst_id,
        })) || [];

      this.logger.log(`Retrieved ${transformedOrders.length} recent orders`);
      return transformedOrders;
    } catch (error) {
      this.logger.error('Error in getRecentOrders:', error);
      return [];
    }
  }

  /**
   * 🚚 Récupérer les expéditions avec suivi (méthode manquante)
   */
  async getShipmentsWithTracking(): Promise<any[]> {
    try {
      this.logger.log('Fetching shipments with tracking');

      const { data, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select(
          `
          ord_id,
          ord_ords_id,
          ord_date,
          ord_cst_id,
          ord_total_ttc
        `,
        )
        .in('ord_ords_id', ['4', '5']) // Prêt et expédié
        .order('ord_date', { ascending: false })
        .limit(50);

      if (error) {
        this.logger.error('Error fetching shipments:', error);
        throw error;
      }

      // Transformer les données pour inclure des infos de suivi simulées
      const shipments =
        data?.map((order) => ({
          id: order.ord_id,
          orderId: order.ord_id,
          status: order.ord_ords_id === '5' ? 'shipped' : 'ready',
          trackingNumber: `TRK${order.ord_id}${Date.now().toString().slice(-4)}`,
          date: order.ord_date,
          customerId: order.ord_cst_id,
          total: parseFloat(order.ord_total_ttc || '0'),
        })) || [];

      this.logger.log(`Retrieved ${shipments.length} shipments`);
      return shipments;
    } catch (error) {
      this.logger.error('Error in getShipmentsWithTracking:', error);
      return [];
    }
  }

  /**
   * 📦 Récupérer les alertes de stock (méthode manquante)
   */
  async getStockAlerts(): Promise<{
    success: boolean;
    alerts: any[];
    count: number;
  }> {
    try {
      this.logger.log('Fetching stock alerts');

      // Pour le moment, retourner des alertes simulées
      // TODO: Implémenter avec les vraies tables de stock quand elles seront identifiées
      const mockAlerts = [
        {
          id: 1,
          productName: 'Produit exemple',
          currentStock: 5,
          minimumStock: 10,
          status: 'low',
          lastUpdate: new Date().toISOString(),
        },
      ];

      return {
        success: true,
        alerts: mockAlerts,
        count: mockAlerts.length,
      };
    } catch (error) {
      this.logger.error('Error in getStockAlerts:', error);
      return {
        success: false,
        alerts: [],
        count: 0,
      };
    }
  }

  async getDashboardStatsFixed(): Promise<{
    totalUsers: number;
    totalOrders: number;
    totalSuppliers: number;
    recentOrders: number;
    success: boolean;
    message: string;
  }> {
    const startTime = Date.now();
    try {
      const cachedStats = await this.cacheService.getOrSet(
        'dashboard:stats:fixed',
        async () => {
          this.logger.log(
            '🔄 Cache MISS - Fetching fresh fixed dashboard stats',
          );

          const [totalUsers, totalOrders, totalSuppliers, recentOrders] =
            await Promise.all([
              this.getUserCountFixed(),
              this.getOrderCountFixed(),
              this.getSupplierCountFixed(),
              this.getRecentOrdersCountFixed(),
            ]);

          return {
            totalUsers,
            totalOrders,
            totalSuppliers,
            recentOrders,
            success: true,
            message:
              'Statistiques dashboard récupérées avec succès (méthodes Fixed modernes avec cache)',
          };
        },
      );

      const performanceTime = Date.now() - startTime;
      this.logger.log(
        `✅ getDashboardStatsFixed completed in ${performanceTime}ms (cache hit: ${performanceTime < 50 ? 'YES' : 'NO'})`,
      );

      return cachedStats;
    } catch (error) {
      const performanceTime = Date.now() - startTime;
      this.logger.error(
        `❌ Erreur getDashboardStatsFixed after ${performanceTime}ms:`,
        error,
      );
      return {
        totalUsers: 0,
        totalOrders: 0,
        totalSuppliers: 0,
        recentOrders: 0,
        success: false,
        message: `Erreur lors de la récupération des statistiques: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }
}
