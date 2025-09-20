/**
 * OPTIMISATIONS AVANCÉES - Analytics & Performance Intelligence
 * Monitoring temps réel des interactions Command Palette
 * A/B Testing automatisé et insights utilisateur
 */

import { useLocation } from '@remix-run/react'
import { useCallback, useEffect, useState } from 'react'

interface AnalyticsEvent {
  id: string
  type: string // Rendu plus flexible pour supporter tous les types d'événements
  timestamp: number
  data: Record<string, any>
  userId?: string
  sessionId: string
  device: 'mobile' | 'tablet' | 'desktop'
  route: string
}

interface ABTestConfig {
  name: string
  variants: string[]
  traffic: number
  goal?: string
  target_metric?: string
}

interface _ABTest {
  id: string
  config: ABTestConfig
  variant: string
  startTime: number
  active: boolean
}

interface UserBehaviorInsights {
  mostUsedCommands: Array<{ command: string; count: number; avgTimeToExecute: number }>
  searchPatterns: Array<{ query: string; resultCount: number; selectedResult?: string }>
  navigationFlow: Array<{ from: string; to: string; method: 'command' | 'click' | 'gesture' }>
  timeSpentByRoute: Record<string, number>
  productivityMetrics: {
    commandPaletteUsage: number // % vs traditional navigation
    avgTaskCompletionTime: number
    errorReduction: number
  }
}

interface PerformanceMetrics {
  commandPaletteRenderTime: number
  searchResponseTime: number
  navigationSpeed: number
  memoryUsage: number
  bundleSize: number
}

export function useAdvancedAnalytics() {
  const location = useLocation()
  const [sessionId] = useState(() => crypto.randomUUID())
  const [insights, setInsights] = useState<UserBehaviorInsights | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [isOptimizationMode, setIsOptimizationMode] = useState(false)

  // Queue d'événements pour batch processing
  const [eventQueue, setEventQueue] = useState<AnalyticsEvent[]>([])

  // Détection du device pour analytics contextuelles
  const getDeviceType = useCallback((): 'mobile' | 'tablet' | 'desktop' => {
    if (typeof window === 'undefined') return 'desktop'
    const width = window.innerWidth
    return width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
  }, [])

  // Enregistrement d'événement analytics
  const trackEvent = useCallback((
    type: AnalyticsEvent['type'],
    data: Record<string, any> = {}
  ) => {
    const event: AnalyticsEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      data,
      sessionId,
      device: getDeviceType(),
      route: location.pathname
    }

    setEventQueue(prev => [...prev, event])

    // Log en développement pour debugging
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log(`📊 Analytics Event [${type}]:`, event)
    }
  }, [sessionId, location.pathname, getDeviceType])

  // Mesure de performance Command Palette
  const measureCommandPalettePerformance = useCallback(() => {
    const measureRenderTime = () => {
      const startTime = performance.now()
      
      // Simulation de mesure (en production, intégrer avec React DevTools Profiler)
      return new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          const endTime = performance.now()
          resolve(endTime - startTime)
        })
      })
    }

    return {
      measureRenderTime,
      measureSearchTime: (query: string) => {
        const start = performance.now()
        return () => {
          const duration = performance.now() - start
          trackEvent('command_palette_search', {
            query,
            searchDuration: duration,
            resultsFound: Math.floor(Math.random() * 10) // Mock, remplacer par vraie logique
          })
          return duration
        }
      }
    }
  }, [trackEvent])

  // A/B Testing automatisé
  const [abTestVariant, setAbTestVariant] = useState<'control' | 'variant_a' | 'variant_b'>('control')
  
  useEffect(() => {
    // Attribution automatique de variant basée sur sessionId
    const hash = sessionId.split('-')[0]
    const hashNum = parseInt(hash, 16) % 3
    setAbTestVariant(hashNum === 0 ? 'control' : hashNum === 1 ? 'variant_a' : 'variant_b')
  }, [sessionId])

  // Configuration A/B Test variants
  const getABTestConfig = useCallback(() => {
    switch (abTestVariant) {
      case 'variant_a':
        return {
          commandPaletteStyle: 'compact', // Style plus compact
          showRecentActions: true,
          maxRecentActions: 5,
          enableAutoComplete: true
        }
      case 'variant_b':
        return {
          commandPaletteStyle: 'expanded', // Style plus large avec descriptions
          showRecentActions: true,
          maxRecentActions: 8,
          enableAutoComplete: true,
          showActionDescriptions: true
        }
      default:
        return {
          commandPaletteStyle: 'default',
          showRecentActions: false,
          maxRecentActions: 3,
          enableAutoComplete: false
        }
    }
  }, [abTestVariant])

  // Calcul des insights comportementaux
  const calculateInsights = useCallback((events: AnalyticsEvent[]): UserBehaviorInsights => {
    // Analyse des commandes les plus utilisées
    const commandUsage = events
      .filter(e => e.type === 'command_execute')
      .reduce((acc, event) => {
        const cmd = event.data.command
        acc[cmd] = (acc[cmd] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const mostUsedCommands = Object.entries(commandUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([command, count]) => ({
        command,
        count,
        avgTimeToExecute: Math.random() * 1000 + 200 // Mock, calculer vraie moyenne
      }))

    // Analyse des patterns de recherche
    const searchEvents = events.filter(e => e.type === 'command_palette_search')
    const searchPatterns = searchEvents
      .reduce((acc, event) => {
        const query = event.data.query
        acc[query] = (acc[query] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    // Flow de navigation
    const navigationFlow = events
      .filter(e => e.type === 'navigation_click' || e.type === 'command_execute')
      .slice(0, 50) // Derniers 50 pour performance
      .map(event => ({
        from: event.route,
        to: event.data.targetRoute || event.route,
        method: event.type === 'command_execute' ? 'command' as const : 'click' as const
      }))

    // Métriques de productivité
    const totalNavigations = events.filter(e => 
      e.type === 'navigation_click' || e.type === 'command_execute'
    ).length

    const commandUsagePercent = totalNavigations > 0 
      ? (events.filter(e => e.type === 'command_execute').length / totalNavigations) * 100 
      : 0

    return {
      mostUsedCommands,
      searchPatterns: Object.entries(searchPatterns).map(([query, count]) => ({
        query,
        resultCount: count,
        selectedResult: 'mock-result' // En production, tracker vraie sélection
      })),
      navigationFlow,
      timeSpentByRoute: {}, // À implémenter avec tracking temps
      productivityMetrics: {
        commandPaletteUsage: commandUsagePercent,
        avgTaskCompletionTime: Math.random() * 2000 + 1000, // Mock
        errorReduction: Math.min(commandUsagePercent * 0.8, 85) // Estimation
      }
    }
  }, [])

  // Monitoring performance en temps réel
  const monitorPerformance = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.performance === 'undefined') return

    // Memory usage (approximatif) - vérification robuste
    const perfMemory = (window.performance as any).memory
    const memoryUsage = perfMemory && typeof perfMemory.usedJSHeapSize === 'number' 
      ? perfMemory.usedJSHeapSize / 1024 / 1024 
      : 0

    // Temps de réponse réseau (simulation)
    const navigationEntries = window.performance.getEntriesByType('navigation')
    const networkTiming = navigationEntries[0] as PerformanceNavigationTiming
    
    setPerformanceMetrics({
      commandPaletteRenderTime: Math.random() * 50 + 10, // Mock, mesurer vraie valeur
      searchResponseTime: Math.random() * 100 + 20,
      navigationSpeed: networkTiming ? (networkTiming.loadEventEnd - networkTiming.fetchStart) : 0,
      memoryUsage,
      bundleSize: Math.random() * 500 + 1000 // Mock, calculer vraie taille bundle
    })
  }, []) // Pas de dépendances car utilise des APIs natives

  // Batch processing des événements (optimisation performance)
  useEffect(() => {
    const interval = setInterval(() => {
      if (eventQueue.length > 0) {
        // En production, envoyer à service analytics (Mixpanel, PostHog, etc.)
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.log(`📊 Batch Analytics: ${eventQueue.length} events`)
        }
        
        // Calculer insights à partir des événements
        const newInsights = calculateInsights(eventQueue)
        setInsights(newInsights)
        
        // Clear queue après envoi
        setEventQueue([])
      }
    }, 5000) // Batch toutes les 5 secondes

    return () => clearInterval(interval)
  }, [eventQueue, calculateInsights])

  // Monitoring performance périodique
  useEffect(() => {
    monitorPerformance()
    const interval = setInterval(monitorPerformance, 10000) // Toutes les 10 secondes
    return () => clearInterval(interval)
  }, [monitorPerformance])

  // Hooks d'optimisation en temps réel
  const enableOptimizationMode = useCallback(() => {
    setIsOptimizationMode(true)
    trackEvent('optimization_mode_enabled', { timestamp: Date.now() })
  }, [trackEvent])

  const disableOptimizationMode = useCallback(() => {
    setIsOptimizationMode(false)
    trackEvent('optimization_mode_disabled', { timestamp: Date.now() })
  }, [trackEvent])

  // Recommandations d'optimisation basées sur analytics
  const getOptimizationRecommendations = useCallback(() => {
    if (!insights) return []

    const recommendations: Array<{
      type: string;
      priority: string;
      message: string;
      action: string;
    }> = []

    // Si usage Command Palette faible, suggérer formation
    if (insights.productivityMetrics.commandPaletteUsage < 30) {
      recommendations.push({
        type: 'training',
        priority: 'high',
        message: 'Usage Command Palette faible. Suggérer formation utilisateur.',
        action: 'show_tutorial'
      })
    }

    // Si recherches fréquentes sans résultat, améliorer index
    const lowResultSearches = insights.searchPatterns.filter(p => p.resultCount === 0)
    if (lowResultSearches.length > 3) {
      recommendations.push({
        type: 'search_improvement',
        priority: 'medium',
        message: 'Plusieurs recherches sans résultat. Améliorer l\'index de recherche.',
        action: 'expand_search_index'
      })
    }

    // Si performance dégradée, suggérer optimisations
    if (performanceMetrics && performanceMetrics.commandPaletteRenderTime > 100) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Temps de rendu Command Palette élevé. Optimiser le composant.',
        action: 'optimize_rendering'
      })
    }

    return recommendations
  }, [insights, performanceMetrics])

  return {
    // Analytics core
    trackEvent,
    insights,
    performanceMetrics,
    
    // A/B Testing
    abTestVariant,
    getABTestConfig,
    
    // Performance monitoring
    measureCommandPalettePerformance,
    monitorPerformance,
    
    // Optimisation
    isOptimizationMode,
    enableOptimizationMode,
    disableOptimizationMode,
    getOptimizationRecommendations,
    
    // Métriques
    sessionId,
    eventQueueLength: eventQueue.length
  }
}

export default useAdvancedAnalytics
