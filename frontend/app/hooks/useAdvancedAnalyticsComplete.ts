import { useState, useCallback, useEffect } from 'react'

interface ABTestConfig {
  name: string
  variants: string[]
  traffic: number
  goal?: string
  target_metric?: string
}

interface ABTest {
  id: string
  config: ABTestConfig
  variant: string
  startTime: number
  active: boolean
}

export function useAdvancedAnalyticsComplete() {
  const [sessionId] = useState(() => crypto.randomUUID())
  const [activeTests, setActiveTests] = useState<Map<string, ABTest>>(new Map())
  const [events, setEvents] = useState<any[]>([])

  // Fonction pour démarrer un test A/B
  const startABTest = useCallback(async (testId: string, config: ABTestConfig) => {
    const variants = config.variants
    const selectedVariant = variants[Math.floor(Math.random() * variants.length)]
    
    const test: ABTest = {
      id: testId,
      config,
      variant: selectedVariant,
      startTime: Date.now(),
      active: true
    }
    
    setActiveTests(prev => new Map(prev).set(testId, test))
    
    // Stocker localement pour persistance
    localStorage.setItem(`ab_test_${testId}`, JSON.stringify(test))
    
    console.log(`🧪 A/B Test démarré: ${testId} -> variante ${selectedVariant}`)
    
    return selectedVariant
  }, [])

  // Fonction pour obtenir la variante d'un test
  const getABTestVariant = useCallback((testId: string): string => {
    // Vérifier dans l'état local
    const activeTest = activeTests.get(testId)
    if (activeTest) {
      return activeTest.variant
    }

    // Vérifier dans localStorage
    const stored = localStorage.getItem(`ab_test_${testId}`)
    if (stored) {
      try {
        const test = JSON.parse(stored)
        setActiveTests(prev => new Map(prev).set(testId, test))
        return test.variant
      } catch (e) {
        console.warn('Erreur parsing test A/B stocké:', e)
      }
    }

    return 'control' // Fallback
  }, [activeTests])

  // Fonction de tracking flexible
  const trackEvent = useCallback((eventType: string, data: Record<string, any> = {}) => {
    const event = {
      id: crypto.randomUUID(),
      type: eventType,
      timestamp: Date.now(),
      sessionId,
      data,
      url: window.location.href,
      userAgent: navigator.userAgent
    }
    
    setEvents(prev => [...prev, event])
    
    // Log en console pour le développement
    console.log(`📊 Événement tracké: ${eventType}`, event)
    
    // Envoyer vers le service de monitoring si disponible
    if (typeof window !== 'undefined') {
      fetch('/api/analytics/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'analytics_batch', 
          events: [event], 
          sessionId,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Erreur envoi analytics:', err))
    }
  }, [sessionId])

  // Métriques de performance simulées
  const getPerformanceMetrics = useCallback(() => {
    return {
      pageLoadTime: window.performance?.timing?.loadEventEnd - window.performance?.timing?.navigationStart || 0,
      domContentLoaded: window.performance?.timing?.domContentLoadedEventEnd - window.performance?.timing?.navigationStart || 0,
      firstContentfulPaint: 0, // Sera calculé par le service de monitoring
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0
    }
  }, [])

  // Insights simulés
  const getInsights = useCallback(() => {
    return [
      {
        type: 'conversion_opportunity',
        message: `987 commandes en attente détectées - Test A/B recommandé`,
        priority: 'high',
        action: 'start_checkout_test'
      },
      {
        type: 'performance',
        message: 'Temps de chargement optimal détecté',
        priority: 'medium',
        action: 'maintain_performance'
      }
    ]
  }, [])

  // Recommandations simulées
  const getRecommendations = useCallback(() => {
    return [
      {
        id: '1',
        title: 'Optimiser le checkout',
        description: 'Test A/B sur le processus de commande pour convertir les 987 commandes pendantes',
        priority: 'high',
        category: 'conversion',
        impact: 'high'
      },
      {
        id: '2', 
        title: 'Améliorer la performance',
        description: 'Optimiser les Web Vitals pour une meilleure expérience utilisateur',
        priority: 'medium',
        category: 'performance',
        impact: 'medium'
      }
    ]
  }, [])

  // Initialisation
  useEffect(() => {
    // Récupérer les tests A/B existants du localStorage
    const keys = Object.keys(localStorage).filter(key => key.startsWith('ab_test_'))
    keys.forEach(key => {
      try {
        const test = JSON.parse(localStorage.getItem(key) || '{}')
        if (test.id) {
          setActiveTests(prev => new Map(prev).set(test.id, test))
        }
      } catch (e) {
        console.warn('Erreur chargement test A/B:', e)
      }
    })
  }, [])

  return {
    // Core analytics
    trackEvent,
    sessionId,
    events,
    
    // A/B Testing
    startABTest,
    getABTestVariant,
    activeTests: Array.from(activeTests.values()),
    
    // Performance & Insights
    getPerformanceMetrics,
    getInsights,
    getRecommendations,
    
    // Utilities
    eventQueueLength: events.length
  }
}
