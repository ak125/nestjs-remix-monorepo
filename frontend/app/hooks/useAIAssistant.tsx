/**
 * AI Assistant pour Command Palette - Optimisation Intelligence
 * Suggestions automatiques, apprentissage des patterns, optimisation prédictive
 */

import { useLocation } from '@remix-run/react'
import { Brain, Sparkles, Lightbulb, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import * as React from "react"

interface AISuggestion {
  id: string
  type: 'action' | 'workflow' | 'optimization' | 'shortcut'
  title: string
  description: string
  confidence: number // 0-1
  action: () => void
  icon: React.ReactNode
  category: 'productivity' | 'navigation' | 'performance' | 'learning'
}

interface UserPattern {
  sequence: string[] // Séquence d'actions
  frequency: number
  timeOfDay: number
  dayOfWeek: number
  context: string // Route où cela se produit
}

interface AIInsight {
  pattern: string
  suggestion: string
  impact: 'low' | 'medium' | 'high'
  implementationDifficulty: 'easy' | 'medium' | 'hard'
}

export function useAIAssistant() {
  const location = useLocation()
  const [userPatterns, setUserPatterns] = useState<UserPattern[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [learningMode, setLearningMode] = useState(true)
  const [actionHistory, setActionHistory] = useState<string[]>([])

  // Détection automatique des patterns utilisateur
  const detectPatterns = useCallback((history: string[]) => {
    if (history.length < 3) return

    // Analyse des séquences de 2-5 actions
    const sequences: { [key: string]: number } = {}
    
    for (let length = 2; length <= Math.min(5, history.length); length++) {
      for (let i = 0; i <= history.length - length; i++) {
        const sequence = history.slice(i, i + length)
        const key = sequence.join(' → ')
        sequences[key] = (sequences[key] || 0) + 1
      }
    }

    // Identifier les patterns fréquents (>= 2 occurrences)
    const frequentPatterns = Object.entries(sequences)
      .filter(([, freq]) => freq >= 2)
      .map(([seq, freq]) => ({
        sequence: seq.split(' → '),
        frequency: freq,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        context: location.pathname
      }))

    setUserPatterns(prev => {
      const updated = [...prev, ...frequentPatterns]
      // Dédupliquer et garder les plus fréquents
      const deduped = updated.reduce((acc, pattern) => {
        const existing = acc.find(p => 
          p.sequence.join('→') === pattern.sequence.join('→') && 
          p.context === pattern.context
        )
        if (existing) {
          existing.frequency += pattern.frequency
        } else {
          acc.push(pattern)
        }
        return acc
      }, [] as UserPattern[])
      
      return deduped.slice(-10) // Garder les 10 plus récents
    })
  }, [location.pathname])

  // Enregistrement des actions pour apprentissage
  const recordAction = useCallback((action: string) => {
    setActionHistory(prev => {
      const updated = [...prev, action].slice(-20) // Garder les 20 dernières
      
      // Détecter les patterns après chaque action
      detectPatterns(updated)
      
      return updated
    })
  }, [detectPatterns])

  // Génération de suggestions IA basées sur les patterns
  const generateAISuggestions = useCallback(() => {
    const suggestions: AISuggestion[] = []
    const currentHour = new Date().getHours()
    const currentDay = new Date().getDay()

    // Suggestions basées sur les patterns temporels
    const contextualPatterns = userPatterns.filter(p => 
      Math.abs(p.timeOfDay - currentHour) <= 2 || // Même heure +/- 2h
      p.dayOfWeek === currentDay || // Même jour de la semaine
      p.context === location.pathname // Même route
    )

    contextualPatterns.forEach((pattern, index) => {
      // Suggestion de workflow automatisé
      if (pattern.frequency >= 3) {
        suggestions.push({
          id: `workflow_${index}`,
          type: 'workflow',
          title: `Automatiser: ${pattern.sequence.slice(0, 2).join(' → ')}...`,
          description: `Pattern détecté ${pattern.frequency} fois. Créer un raccourci?`,
          confidence: Math.min(pattern.frequency / 5, 1),
          action: () => {
            alert(`Création du workflow: ${pattern.sequence.join(' → ')}`)
          },
          icon: <Sparkles className="w-4 h-4" />,
          category: 'productivity'
        })
      }
    })

    // Suggestions contextuelles intelligentes
    if (location.pathname.includes('/admin/users') && currentHour >= 9 && currentHour <= 17) {
      suggestions.push({
        id: 'users_bulk_actions',
        type: 'action',
        title: 'Actions groupées utilisateurs',
        description: 'Souvent utilisé à cette heure. Prêt à importer/exporter?',
        confidence: 0.8,
        action: () => {
          // Ouvrir command palette avec pré-remplissage
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: true,
            bubbles: true
          }))
        },
        icon: <TrendingUp className="w-4 h-4" />,
        category: 'productivity'
      })
    }

    // Suggestions d'optimisation performance
    if (actionHistory.length > 10) {
      const recentActions = actionHistory.slice(-10)
      const uniqueActions = new Set(recentActions).size
      
      if (uniqueActions / recentActions.length < 0.5) { // Beaucoup de répétitions
        suggestions.push({
          id: 'performance_optimize',
          type: 'optimization',
          title: 'Optimiser navigation',
          description: 'Actions répétitives détectées. Voir suggestions d\'amélioration?',
          confidence: 0.9,
          action: () => {
            window.location.href = '/optimization-dashboard'
          },
          icon: <Brain className="w-4 h-4" />,
          category: 'performance'
        })
      }
    }

    // Suggestions d'apprentissage
    if (actionHistory.length < 5) {
      suggestions.push({
        id: 'learning_tutorial',
        type: 'shortcut',
        title: 'Découvrir les raccourcis',
        description: 'Nouvelle session détectée. Explorer les fonctionnalités?',
        confidence: 0.7,
        action: () => {
          alert('Tutoriel interactif des raccourcis (à implémenter)')
        },
        icon: <Lightbulb className="w-4 h-4" />,
        category: 'learning'
      })
    }

    // Tri par confiance et pertinence
    suggestions.sort((a, b) => b.confidence - a.confidence)
    setAiSuggestions(suggestions.slice(0, 5)) // Top 5 suggestions
  }, [userPatterns, location.pathname, actionHistory])

  // Regeneration périodique des suggestions
  useEffect(() => {
    if (learningMode) {
      generateAISuggestions()
      
      const interval = setInterval(generateAISuggestions, 30000) // Toutes les 30 secondes
      return () => clearInterval(interval)
    }
  }, [learningMode, generateAISuggestions])

  // Insights IA sur les habitudes utilisateur
  const getAIInsights = useCallback((): AIInsight[] => {
    const insights: AIInsight[] = []

    // Analyse temporelle
    const hourCounts = actionHistory.reduce((acc, _, index) => {
      const hour = new Date(Date.now() - (actionHistory.length - index) * 60000).getHours()
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    const peakHour = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)[0]

    if (peakHour) {
      insights.push({
        pattern: `Pic d'activité à ${peakHour[0]}h`,
        suggestion: 'Configurer notifications intelligentes pour cette période',
        impact: 'medium',
        implementationDifficulty: 'easy'
      })
    }

    // Analyse de diversité
    const uniqueActions = new Set(actionHistory).size
    const diversityRatio = actionHistory.length > 0 ? uniqueActions / actionHistory.length : 0

    if (diversityRatio < 0.3) {
      insights.push({
        pattern: 'Actions très répétitives détectées',
        suggestion: 'Créer des macros ou workflows automatisés',
        impact: 'high',
        implementationDifficulty: 'medium'
      })
    }

    // Analyse contextuelle
    const routeUsage = userPatterns.reduce((acc, pattern) => {
      acc[pattern.context] = (acc[pattern.context] || 0) + pattern.frequency
      return acc
    }, {} as Record<string, number>)

    const topRoute = Object.entries(routeUsage)
      .sort(([,a], [,b]) => b - a)[0]

    if (topRoute && topRoute[1] > 5) {
      insights.push({
        pattern: `Route ${topRoute[0]} très utilisée`,
        suggestion: 'Personnaliser la navigation pour cette section',
        impact: 'medium',
        implementationDifficulty: 'medium'
      })
    }

    return insights
  }, [actionHistory, userPatterns])

  // Exécution d'une suggestion avec apprentissage
  const executeSuggestion = useCallback((suggestion: AISuggestion) => {
    suggestion.action()
    recordAction(`ai_suggestion:${suggestion.type}:${suggestion.id}`)
    
    // Retirer la suggestion exécutée
    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
    
    // Log pour amélioration future
    console.log(`🤖 AI Suggestion executed: ${suggestion.title}`)
  }, [recordAction])

  // Toggle learning mode
  const toggleLearningMode = useCallback(() => {
    setLearningMode(prev => !prev)
    if (!learningMode) {
      generateAISuggestions()
    }
  }, [learningMode, generateAISuggestions])

  // Reset learning data
  const resetLearning = useCallback(() => {
    setUserPatterns([])
    setActionHistory([])
    setAiSuggestions([])
    localStorage.removeItem('ai_assistant_patterns')
    localStorage.removeItem('ai_assistant_history')
  }, [])

  // Persistance des données d'apprentissage
  useEffect(() => {
    // Charger données sauvegardées
    try {
      const savedPatterns = localStorage.getItem('ai_assistant_patterns')
      const savedHistory = localStorage.getItem('ai_assistant_history')
      
      if (savedPatterns) {
        setUserPatterns(JSON.parse(savedPatterns))
      }
      if (savedHistory) {
        setActionHistory(JSON.parse(savedHistory))
      }
    } catch (error) {
      console.warn('Erreur chargement AI Assistant:', error)
    }
  }, [])

  // Sauvegarder données
  useEffect(() => {
    try {
      localStorage.setItem('ai_assistant_patterns', JSON.stringify(userPatterns))
      localStorage.setItem('ai_assistant_history', JSON.stringify(actionHistory))
    } catch (error) {
      console.warn('Erreur sauvegarde AI Assistant:', error)
    }
  }, [userPatterns, actionHistory])

  return {
    // Core AI functions
    recordAction,
    aiSuggestions,
    executeSuggestion,
    
    // Learning management
    learningMode,
    toggleLearningMode,
    resetLearning,
    
    // Analytics
    userPatterns,
    getAIInsights,
    
    // Stats
    totalActions: actionHistory.length,
    uniqueActions: new Set(actionHistory).size,
    patternsDetected: userPatterns.length
  }
}

export default useAIAssistant
