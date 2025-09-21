import { Injectable } from '@nestjs/common';
import { OptimizedBreadcrumbService } from '../modules/config/services/optimized-breadcrumb.service';

@Injectable()
export class BreadcrumbUsageExample {
  constructor(private readonly breadcrumbService: OptimizedBreadcrumbService) {}

  async exempleUtilisationBreadcrumb() {
    // 🧭 Générer un breadcrumb pour une route
    const breadcrumb = await this.breadcrumbService.generateBreadcrumb(
      '/products/vehicles/cars/bmw/series-3',
      'fr', // langue
      'user123', // userId optionnel pour analytics
    );

    console.log('Breadcrumb généré:', breadcrumb);
    // Résultat: [
    //   { label: 'Accueil', url: '/', icon: 'home' },
    //   { label: 'Produits', url: '/products', icon: 'products' },
    //   { label: 'Véhicules', url: '/products/vehicles', icon: 'car' },
    //   { label: 'Voitures', url: '/products/vehicles/cars', icon: 'car' },
    //   { label: 'BMW', url: '/products/vehicles/cars/bmw', icon: 'brand' },
    //   { label: 'Série 3', url: '/products/vehicles/cars/bmw/series-3', icon: 'model' }
    // ]

    // 📊 Récupérer les statistiques des breadcrumbs
    const stats = await this.breadcrumbService.getBreadcrumbStats();
    console.log('Statistiques breadcrumb:', {
      totalGenerated: stats.totalGenerated,
      mostPopularRoutes: stats.mostPopularRoutes,
      averageDepth: stats.averageDepth,
      cacheHitRate: stats.cacheHitRate,
    });

    // 🗑️ Invalider le cache pour une route spécifique
    await this.breadcrumbService.invalidateBreadcrumbCache(
      '/products/vehicles/cars',
      'fr',
    );

    // 🧹 Invalider tout le cache des breadcrumbs
    await this.breadcrumbService.invalidateBreadcrumbCache();

    // 🔄 Générer des breadcrumbs pour plusieurs routes (optimisé)
    const routes = [
      '/products/vehicles/cars',
      '/products/vehicles/motorcycles',
      '/products/tools/mechanical',
    ];

    const multipleBreadcrumbs = await Promise.all(
      routes.map((route) =>
        this.breadcrumbService.generateBreadcrumb(route, 'fr'),
      ),
    );

    console.log('Breadcrumbs multiples:', multipleBreadcrumbs);
  }

  // 🎯 Utilisation dans un controller
  async getBreadcrumbForRoute(route: string, lang = 'fr', userId?: string) {
    try {
      const breadcrumb = await this.breadcrumbService.generateBreadcrumb(
        route,
        lang,
        userId,
      );

      return {
        success: true,
        data: breadcrumb,
        meta: {
          route,
          lang,
          itemsCount: breadcrumb.length,
          fromCache: true, // Sera déterminé automatiquement
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to generate breadcrumb',
        message: error.message,
      };
    }
  }
}
