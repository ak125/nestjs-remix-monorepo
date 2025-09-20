import { Injectable } from '@nestjs/common';
import { ConfigAnalyticsService } from '../modules/config/services/config-analytics.service';

@Injectable()
export class AnalyticsUsageExample {
  constructor(private readonly analyticsService: ConfigAnalyticsService) {}

  async exempleUtilisationAnalytics() {
    // 📊 Tracker un événement de configuration
    await this.analyticsService.trackConfigEvent({
      type: 'config_access',
      category: 'user_settings',
      action: 'theme_changed',
      label: 'dark_mode',
      userId: 'user123',
      route: '/settings/appearance',
      metadata: {
        previousTheme: 'light',
        newTheme: 'dark',
        timestamp: new Date().toISOString(),
      },
    });

    // 🔍 Tracker un changement de configuration
    await this.analyticsService.trackConfigEvent({
      type: 'config_change',
      category: 'admin',
      action: 'feature_toggle',
      label: 'new_dashboard',
      userId: 'admin456',
      route: '/admin/features',
      metadata: {
        feature: 'new_dashboard',
        enabled: true,
        environment: 'production',
      },
    });

    // 🧭 Tracker la génération de breadcrumb
    await this.analyticsService.trackConfigEvent({
      type: 'breadcrumb_generation',
      category: 'navigation',
      action: 'breadcrumb_generated',
      label: '/products/vehicles/cars',
      userId: 'user789',
      route: '/products/vehicles/cars',
      metadata: {
        depth: 3,
        items: ['Accueil', 'Produits', 'Véhicules', 'Voitures'],
      },
    });

    // 📈 Récupérer les métriques
    const weeklyMetrics = await this.analyticsService.getConfigMetrics('week');
    console.log('Métriques de la semaine:', {
      totalEvents: weeklyMetrics.totalEvents,
      configAccess: weeklyMetrics.configAccess,
      configChanges: weeklyMetrics.configChanges,
      breadcrumbGenerations: weeklyMetrics.breadcrumbGenerations,
      uniqueUsers: weeklyMetrics.uniqueUsers,
    });

    // 🎯 Métriques par catégorie
    const categoryMetrics = await this.analyticsService.getMetricsByCategory(
      'user_settings',
      'month',
    );
    console.log('Métriques user_settings:', categoryMetrics);
  }
}