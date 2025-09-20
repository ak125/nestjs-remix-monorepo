/**
 * 🚀 Enhanced API Service - Services Frontend pour root.tsx optimisé
 * Utilise les services backend réels disponibles
 */

export interface PageMetadata {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  robots?: string;
}

export interface AnalyticsConfig {
  isActive: boolean;
  script: string;
  trackingId: string;
  measurementId?: string;
  debug?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}

class EnhancedApiService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.API_BASE_URL || 'http://localhost:3000';
  }

  /**
   * 📄 Récupérer les métadonnées d'une page
   * Utilise OptimizedMetadataService
   */
  async getPageMetadata(pathname: string): Promise<PageMetadata | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/metadata${pathname}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Métadonnées indisponibles pour ${pathname}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.warn(`❌ Erreur métadonnées ${pathname}:`, error);
      return null;
    }
  }

  /**
   * 📊 Récupérer la configuration Analytics 
   * Utilise AnalyticsConfigurationService
   */
  async getAnalyticsConfig(): Promise<AnalyticsConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analytics/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Analytics config indisponible: ${response.status}`);
        return { isActive: false, script: '', trackingId: '' };
      }

      const data = await response.json();
      return data.success ? data.data : { isActive: false, script: '', trackingId: '' };
    } catch (error) {
      console.warn(`❌ Erreur analytics config:`, error);
      return { isActive: false, script: '', trackingId: '' };
    }
  }

  /**
   * 🧭 Récupérer le fil d'Ariane
   * Utilise OptimizedBreadcrumbService
   */
  async getBreadcrumbs(pathname: string): Promise<BreadcrumbItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/breadcrumb${pathname}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Breadcrumbs indisponibles pour ${pathname}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.success && Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.warn(`❌ Erreur breadcrumbs ${pathname}:`, error);
      return [];
    }
  }

  /**
   * 🎯 Récupérer toutes les données pour une page (loader optimisé)
   */
  async getPageData(pathname: string) {
    const [metadata, analytics, breadcrumbs] = await Promise.allSettled([
      this.getPageMetadata(pathname),
      this.getAnalyticsConfig(),
      this.getBreadcrumbs(pathname),
    ]);

    return {
      metadata: metadata.status === 'fulfilled' ? metadata.value : null,
      analytics: analytics.status === 'fulfilled' ? analytics.value : { isActive: false, script: '', trackingId: '' },
      breadcrumbs: breadcrumbs.status === 'fulfilled' ? breadcrumbs.value : [],
    };
  }

  /**
   * 🔄 Récupérer le script Analytics optimisé
   */
  async getAnalyticsScript(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analytics/script`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.warn(`❌ Analytics script indisponible: ${response.status}`);
        return '';
      }

      return await response.text();
    } catch (error) {
      console.warn(`❌ Erreur analytics script:`, error);
      return '';
    }
  }

  /**
   * 📊 Récupérer les balises HTML métadonnées formatées
   */
  async getMetaTags(pathname: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/metadata${pathname}/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.warn(`❌ Meta tags indisponibles pour ${pathname}: ${response.status}`);
        return '';
      }

      const data = await response.json();
      return data.success ? data.data : '';
    } catch (error) {
      console.warn(`❌ Erreur meta tags ${pathname}:`, error);
      return '';
    }
  }
}

// Export singleton
export const enhancedApi = new EnhancedApiService();

/**
 * 🎯 Métadonnées par défaut fallback
 */
export const getDefaultMetadata = (pathname: string): PageMetadata => ({
  title: pathname === '/' 
    ? "AutoMecanik - Pièces Auto & Services Mécaniques" 
    : `${pathname.split('/').pop()?.replace(/-/g, ' ') || 'Page'} | AutoMecanik`,
  description: "Trouvez vos pièces auto et services mécaniques. Diagnostic, réparation, entretien automobile professionnel.",
  keywords: ["pièces auto", "garage", "réparation automobile", "diagnostic", "entretien"],
  canonicalUrl: `https://automecanik.com${pathname}`,
  robots: "index,follow",
});

/**
 * 🛡️ Validation des données métadonnées
 */
export const validateMetadata = (metadata: any): PageMetadata => {
  if (!metadata || typeof metadata !== 'object') {
    return getDefaultMetadata('/');
  }

  return {
    title: typeof metadata.title === 'string' ? metadata.title : "AutoMecanik",
    description: typeof metadata.description === 'string' ? metadata.description : "Pièces Auto & Services",
    keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
    canonicalUrl: typeof metadata.canonicalUrl === 'string' ? metadata.canonicalUrl : undefined,
    ogTitle: typeof metadata.ogTitle === 'string' ? metadata.ogTitle : undefined,
    ogDescription: typeof metadata.ogDescription === 'string' ? metadata.ogDescription : undefined,
    ogImage: typeof metadata.ogImage === 'string' ? metadata.ogImage : undefined,
    robots: typeof metadata.robots === 'string' ? metadata.robots : "index,follow",
  };
};