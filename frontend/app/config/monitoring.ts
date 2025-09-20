/**
 * Configuration de monitoring des métriques de performance en production
 * Intégration avec les hooks d'analytics avancées
 */

export interface MonitoringConfig {
  // Configuration des métriques
  metrics: {
    // Métriques de performance web vitals
    webVitals: {
      enabled: boolean
      thresholds: {
        lcp: number // Largest Contentful Paint
        fid: number // First Input Delay
        cls: number // Cumulative Layout Shift
        fcp: number // First Contentful Paint
        ttfb: number // Time to First Byte
      }
    }
    
    // Métriques business
    business: {
      enabled: boolean
      conversionTracking: boolean
      revenueTracking: boolean
      userEngagementTracking: boolean
    }
    
    // Métriques d'erreur
    errors: {
      enabled: boolean
      jsErrors: boolean
      apiErrors: boolean
      renderErrors: boolean
    }
  }
  
  // Configuration A/B Testing
  abTesting: {
    enabled: boolean
    defaultTrafficAllocation: number
    maxConcurrentTests: number
    minimumSampleSize: number
    confidenceLevel: number
  }
  
  // Configuration IA Assistant
  aiAssistant: {
    enabled: boolean
    learningMode: 'aggressive' | 'moderate' | 'conservative'
    suggestionFrequency: number // en millisecondes
    patternDetectionThreshold: number // score de confiance minimum
  }
  
  // Endpoints de reporting
  reporting: {
    analyticsEndpoint: string
    errorReportingEndpoint: string
    performanceEndpoint: string
  }
}

// Configuration par défaut pour production
export const PRODUCTION_MONITORING_CONFIG: MonitoringConfig = {
  metrics: {
    webVitals: {
      enabled: true,
      thresholds: {
        lcp: 2500, // 2.5s
        fid: 100,  // 100ms
        cls: 0.1,  // 0.1
        fcp: 1800, // 1.8s
        ttfb: 800  // 800ms
      }
    },
    business: {
      enabled: true,
      conversionTracking: true,
      revenueTracking: true,
      userEngagementTracking: true
    },
    errors: {
      enabled: true,
      jsErrors: true,
      apiErrors: true,
      renderErrors: true
    }
  },
  abTesting: {
    enabled: true,
    defaultTrafficAllocation: 0.1, // 10% du trafic par défaut
    maxConcurrentTests: 5,
    minimumSampleSize: 100,
    confidenceLevel: 0.95
  },
  aiAssistant: {
    enabled: true,
    learningMode: 'moderate',
    suggestionFrequency: 30000, // 30 secondes
    patternDetectionThreshold: 0.75 // 75% de confiance minimum
  },
  reporting: {
    analyticsEndpoint: '/api/analytics/report',
    errorReportingEndpoint: '/api/errors/report',
    performanceEndpoint: '/api/performance/report'
  }
}

// Configuration pour développement
export const DEVELOPMENT_MONITORING_CONFIG: MonitoringConfig = {
  ...PRODUCTION_MONITORING_CONFIG,
  metrics: {
    ...PRODUCTION_MONITORING_CONFIG.metrics,
    webVitals: {
      ...PRODUCTION_MONITORING_CONFIG.metrics.webVitals,
      enabled: true // Activé même en dev pour les tests
    }
  },
  abTesting: {
    ...PRODUCTION_MONITORING_CONFIG.abTesting,
    enabled: true,
    defaultTrafficAllocation: 0.5, // 50% en dev pour plus de tests
    minimumSampleSize: 10 // Échantillon plus petit en dev
  },
  aiAssistant: {
    ...PRODUCTION_MONITORING_CONFIG.aiAssistant,
    learningMode: 'aggressive', // Plus de logs en dev
    suggestionFrequency: 10000, // Plus fréquent en dev
    patternDetectionThreshold: 0.5 // Seuil plus bas en dev
  }
}

// Utilitaire pour obtenir la config selon l'environnement
export function getMonitoringConfig(): MonitoringConfig {
  const isDev = typeof window !== 'undefined' 
    ? window.location.hostname === 'localhost' || window.location.hostname.includes('dev')
    : false
  return isDev ? DEVELOPMENT_MONITORING_CONFIG : PRODUCTION_MONITORING_CONFIG
}

// Types pour les événements de monitoring
export interface AnalyticsEvent {
  type: string
  timestamp: string
  userId?: string
  sessionId?: string
  data: Record<string, any>
  context: {
    page: string
    userAgent: string
    viewport: {
      width: number
      height: number
    }
    connection?: {
      effectiveType: string
      downlink: number
    }
  }
}

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: string
  context: {
    page: string
    device: string
    connection: string
  }
}

export interface ABTestResult {
  testId: string
  variant: string
  userId?: string
  sessionId?: string
  conversion: boolean
  timestamp: string
  metrics: {
    timeSpent: number
    interactions: number
    bounceRate: number
  }
}

export interface AIInsight {
  type: 'pattern' | 'recommendation' | 'prediction'
  confidence: number
  title: string
  description: string
  suggestedActions: string[]
  priority: 'high' | 'medium' | 'low'
  timestamp: string
  data: Record<string, any>
}

// Fonctions utilitaires pour le monitoring
export class MonitoringUtils {
  static createEvent(type: string, data: Record<string, any>): AnalyticsEvent {
    return {
      type,
      timestamp: new Date().toISOString(),
      data,
      context: {
        page: window.location.pathname,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        connection: (navigator as any).connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink
        } : undefined
      }
    }
  }

  static createPerformanceMetric(name: string, value: number): PerformanceMetric {
    return {
      name,
      value,
      timestamp: new Date().toISOString(),
      context: {
        page: window.location.pathname,
        device: this.getDeviceType(),
        connection: this.getConnectionType()
      }
    }
  }

  static getDeviceType(): string {
    const ua = navigator.userAgent
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) return 'mobile'
    return 'desktop'
  }

  static getConnectionType(): string {
    const connection = (navigator as any).connection
    return connection ? connection.effectiveType : 'unknown'
  }

  static calculateConversionRate(completedActions: number, totalActions: number): number {
    if (totalActions === 0) return 0
    return (completedActions / totalActions) * 100
  }

  static generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
  }
}

// Configuration des alertes
export interface AlertConfig {
  performance: {
    slowPageLoad: number // seuil en ms
    highErrorRate: number // pourcentage
    lowConversionRate: number // pourcentage
  }
  business: {
    revenueDropThreshold: number // pourcentage de baisse
    userDropThreshold: number // pourcentage de baisse
    orderDropThreshold: number // pourcentage de baisse
  }
  technical: {
    errorBudget: number // nombre d'erreurs max par heure
    uptimeThreshold: number // pourcentage minimum
  }
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  performance: {
    slowPageLoad: 3000, // 3 secondes
    highErrorRate: 5, // 5%
    lowConversionRate: 1 // 1%
  },
  business: {
    revenueDropThreshold: 20, // 20% de baisse
    userDropThreshold: 15, // 15% de baisse  
    orderDropThreshold: 25 // 25% de baisse
  },
  technical: {
    errorBudget: 50, // 50 erreurs max par heure
    uptimeThreshold: 99.9 // 99.9% uptime minimum
  }
}
