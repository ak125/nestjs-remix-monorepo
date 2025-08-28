/**
 * Hook pour la Command Palette Universal
 * Gère l'état, les raccourcis, et l'historique des commandes
 */

import { useLocation } from '@remix-run/react'
import { useState, useEffect, useCallback } from 'react'

interface RecentAction {
  id: string
  label: string
  href: string
  timestamp: number
  count: number
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [recentActions, setRecentActions] = useState<RecentAction[]>([])
  const location = useLocation()

  // Charger les actions récentes depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('command-palette-recent')
      if (saved) {
        setRecentActions(JSON.parse(saved))
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des actions récentes:', error)
    }
  }, [])

  // Sauvegarder les actions récentes
  const saveRecentActions = useCallback((actions: RecentAction[]) => {
    try {
      localStorage.setItem('command-palette-recent', JSON.stringify(actions))
      setRecentActions(actions)
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde des actions récentes:', error)
    }
  }, [])

  // Ajouter une action aux récentes
  const addRecentAction = useCallback((action: {
    id: string
    label: string
    href: string
  }) => {
    const now = Date.now()
    
    setRecentActions(current => {
      // Vérifier si l'action existe déjà
      const existingIndex = current.findIndex(item => item.id === action.id)
      
      let newActions: RecentAction[]
      
      if (existingIndex >= 0) {
        // Action existante : incrémenter le compteur et mettre à jour timestamp
        newActions = [...current]
        newActions[existingIndex] = {
          ...newActions[existingIndex],
          timestamp: now,
          count: newActions[existingIndex].count + 1
        }
      } else {
        // Nouvelle action
        const newAction: RecentAction = {
          ...action,
          timestamp: now,
          count: 1
        }
        newActions = [newAction, ...current]
      }
      
      // Garder seulement les 8 plus récentes, triées par usage et temps
      newActions = newActions
        .sort((a, b) => {
          // Favoriser les actions fréquentes et récentes
          const scoreA = a.count * 0.3 + (a.timestamp / 1000000) * 0.7
          const scoreB = b.count * 0.3 + (b.timestamp / 1000000) * 0.7
          return scoreB - scoreA
        })
        .slice(0, 8)
      
      // Sauvegarder
      saveRecentActions(newActions)
      
      return newActions
    })
  }, [saveRecentActions])

  // Raccourcis clavier globaux
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K pour ouvrir/fermer
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(prev => !prev)
        return
      }
      
      // Escape pour fermer
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Fermer automatiquement lors d'un changement de route
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Analytics simples des actions
  const trackAction = useCallback((actionId: string, actionType: 'navigation' | 'search' | 'shortcut' = 'navigation') => {
    // Ici on pourrait intégrer avec un service d'analytics
    console.log(`Command Palette Action: ${actionId} (${actionType})`)
  }, [])

  return {
    isOpen,
    setIsOpen,
    recentActions,
    addRecentAction,
    trackAction
  }
}

export default useCommandPalette
