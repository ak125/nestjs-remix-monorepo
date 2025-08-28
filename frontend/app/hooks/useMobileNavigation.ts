/**
 * Hook Mobile Detection & Responsive Navigation
 * Détection intelligente du contexte d'usage pour UX adaptive
 */

import { useCallback, useEffect, useState } from 'react'

interface MobileDetectionState {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenWidth: number
  screenHeight: number
  orientation: 'portrait' | 'landscape'
  isTouchDevice: boolean
  preferredNavigation: 'sidebar' | 'bottom-tabs' | 'drawer'
}

interface NavigationPreferences {
  compactMode: boolean
  showLabels: boolean
  showIcons: boolean
  maxVisibleItems: number
  enableGestures: boolean
}

export function useMobileNavigation() {
  const [state, setState] = useState<MobileDetectionState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 1920,
    screenHeight: 1080,
    orientation: 'landscape',
    isTouchDevice: false,
    preferredNavigation: 'sidebar'
  })

  const [preferences, setPreferences] = useState<NavigationPreferences>({
    compactMode: false,
    showLabels: true,
    showIcons: true,
    maxVisibleItems: 8,
    enableGestures: false
  })

  // Détection des capabilities du device
  const detectDeviceCapabilities = useCallback(() => {
    if (typeof window === 'undefined') return

    const width = window.innerWidth
    const height = window.innerHeight
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    
    // Classification des devices
    const isMobile = width < 768
    const isTablet = width >= 768 && width < 1024
    const isDesktop = width >= 1024

    // Orientation
    const orientation = width > height ? 'landscape' : 'portrait'

    // Navigation préférée selon le contexte
    let preferredNavigation: 'sidebar' | 'bottom-tabs' | 'drawer' = 'sidebar'
    
    if (isMobile) {
      preferredNavigation = orientation === 'portrait' ? 'bottom-tabs' : 'drawer'
    } else if (isTablet) {
      preferredNavigation = 'drawer'
    }

    setState({
      isMobile,
      isTablet,
      isDesktop,
      screenWidth: width,
      screenHeight: height,
      orientation,
      isTouchDevice,
      preferredNavigation
    })

    // Préférences adaptatives
    setPreferences({
      compactMode: isMobile || (isTablet && orientation === 'portrait'),
      showLabels: !isMobile || orientation === 'landscape',
      showIcons: true,
      maxVisibleItems: isMobile ? 5 : isTablet ? 6 : 8,
      enableGestures: isTouchDevice
    })
  }, [])

  // Écoute des changements de taille/orientation
  useEffect(() => {
    detectDeviceCapabilities()

    const handleResize = () => {
      detectDeviceCapabilities()
    }

    const handleOrientationChange = () => {
      // Délai pour laisser le temps au navigateur de s'adapter
      setTimeout(detectDeviceCapabilities, 100)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [detectDeviceCapabilities])

  // Gestionnaires de gestures pour mobile
  const createSwipeHandler = useCallback((onSwipeLeft?: () => void, onSwipeRight?: () => void) => {
    if (!preferences.enableGestures || !state.isTouchDevice) return

    let touchStartX = 0
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartX || !touchStartY) return

      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      
      const diffX = touchStartX - touchEndX
      const diffY = touchStartY - touchEndY

      // Swipe horizontal (plus significatif que vertical)
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > 50) { // Seuil minimum
          if (diffX > 0 && onSwipeLeft) {
            onSwipeLeft()
          } else if (diffX < 0 && onSwipeRight) {
            onSwipeRight()
          }
        }
      }

      touchStartX = 0
      touchStartY = 0
    }

    return { handleTouchStart, handleTouchEnd }
  }, [preferences.enableGestures, state.isTouchDevice])

  // Utilitaires pour les composants
  const getNavigationClasses = useCallback((baseClasses: string = '') => {
    const classes = [baseClasses]

    if (state.isMobile) {
      classes.push('mobile-nav')
    }
    
    if (preferences.compactMode) {
      classes.push('compact-mode')
    }

    if (state.preferredNavigation === 'bottom-tabs') {
      classes.push('bottom-navigation')
    }

    return classes.filter(Boolean).join(' ')
  }, [state.isMobile, preferences.compactMode, state.preferredNavigation])

  // Calcul de la hauteur safe area (iPhone notch, etc.)
  const getSafeAreaInsets = useCallback(() => {
    if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 }

    const style = getComputedStyle(document.documentElement)
    
    return {
      top: parseInt(style.getPropertyValue('--safe-area-inset-top')) || 0,
      bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom')) || 0,
      left: parseInt(style.getPropertyValue('--safe-area-inset-left')) || 0,
      right: parseInt(style.getPropertyValue('--safe-area-inset-right')) || 0
    }
  }, [])

  // Performance: préférences utilisateur persistantes
  const savePreferences = useCallback((newPreferences: Partial<NavigationPreferences>) => {
    const updated = { ...preferences, ...newPreferences }
    setPreferences(updated)
    
    try {
      localStorage.setItem('mobile-navigation-preferences', JSON.stringify(updated))
    } catch (error) {
      console.warn('Impossible de sauvegarder les préférences:', error)
    }
  }, [preferences])

  // Charger les préférences sauvegardées
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mobile-navigation-preferences')
      if (saved) {
        const parsed = JSON.parse(saved)
        setPreferences(current => ({ ...current, ...parsed }))
      }
    } catch (error) {
      console.warn('Impossible de charger les préférences:', error)
    }
  }, [])

  return {
    // État du device
    ...state,
    
    // Préférences navigation
    preferences,
    savePreferences,
    
    // Utilitaires
    getNavigationClasses,
    getSafeAreaInsets,
    createSwipeHandler,
    
    // Helpers de condition
    isSmallScreen: state.isMobile || (state.isTablet && state.orientation === 'portrait'),
    shouldUseBottomTabs: state.preferredNavigation === 'bottom-tabs',
    shouldUseDrawer: state.preferredNavigation === 'drawer',
    shouldUseSidebar: state.preferredNavigation === 'sidebar',
    
    // Métriques utiles
    availableHeight: state.screenHeight - getSafeAreaInsets().top - getSafeAreaInsets().bottom,
    availableWidth: state.screenWidth - getSafeAreaInsets().left - getSafeAreaInsets().right
  }
}

export default useMobileNavigation
