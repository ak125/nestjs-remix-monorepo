import { useEffect } from "react";
import type { VehicleData } from "~/types/vehicle.types";

interface VehicleAnalyticsProps {
  vehicle: VehicleData;
  userId?: string;
}

interface AnalyticsEvent {
  eventType: 'page_view' | 'part_click' | 'image_view' | 'search' | 'interaction';
  vehicleData: {
    brand: string;
    model: string;
    type: string;
    vehicleId?: number;
  };
  metadata?: {
    userId?: string;
    sessionId?: string;
    timestamp: string;
    userAgent: string;
    referrer?: string;
    page: string;
  };
}

export function VehicleAnalytics({ vehicle, userId }: VehicleAnalyticsProps) {
  
  const trackEvent = (eventType: AnalyticsEvent['eventType'], additionalData?: any) => {
    const event: AnalyticsEvent = {
      eventType,
      vehicleData: {
        brand: vehicle.brand,
        model: vehicle.model,
        type: vehicle.type,
        vehicleId: vehicle.brandId || vehicle.modelId || vehicle.typeId
      },
      metadata: {
        userId,
        sessionId: getSessionId(),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        page: window.location.pathname,
        ...additionalData
      }
    };

    // Envoi vers l'API analytics
    sendAnalyticsEvent(event);
    
    // Google Analytics (si configuré)
    if (typeof gtag !== 'undefined') {
      gtag('event', eventType, {
        custom_parameter_vehicle_brand: vehicle.brand,
        custom_parameter_vehicle_model: vehicle.model,
        custom_parameter_vehicle_type: vehicle.type,
        ...additionalData
      });
    }

    // Analytics console pour debug
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Vehicle Analytics Event:', event);
    }
  };

  const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  };

  const sendAnalyticsEvent = async (event: AnalyticsEvent) => {
    try {
      // Envoi vers l'API backend
      await fetch('/api/analytics/vehicle-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Erreur envoi analytics:', error);
    }
  };

  // Tracking automatique au montage du composant
  useEffect(() => {
    trackEvent('page_view');
    
    // Tracking du temps passé sur la page
    const startTime = Date.now();
    
    return () => {
      const timeSpent = Date.now() - startTime;
      trackEvent('interaction', { 
        timeSpent: Math.round(timeSpent / 1000),
        action: 'page_exit'
      });
    };
  }, [vehicle.brand, vehicle.model, vehicle.type]);

  // Fonction utilitaires pour les composants enfants
  const trackPartClick = (partId: number, partName: string) => {
    trackEvent('part_click', { partId, partName });
  };

  const trackImageView = (imageIndex: number) => {
    trackEvent('image_view', { imageIndex });
  };

  const trackSearch = (searchTerm: string, resultsCount: number) => {
    trackEvent('search', { searchTerm, resultsCount });
  };

  // Performance monitoring
  useEffect(() => {
    // Performance de chargement de la page
    if ('performance' in window) {
      const perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            trackEvent('interaction', {
              action: 'performance_metrics',
              loadTime: navEntry.loadEventEnd - navEntry.loadEventStart,
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              firstContentfulPaint: navEntry.loadEventEnd - navEntry.fetchStart
            });
          }
        }
      });
      
      perfObserver.observe({ entryTypes: ['navigation'] });
      
      return () => perfObserver.disconnect();
    }
  }, []);

  // Tracking des erreurs JavaScript
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackEvent('interaction', {
        action: 'javascript_error',
        error: event.error?.message || 'Unknown error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Le composant ne rend rien visuellement mais expose des méthodes
  // pour que les composants parent puissent tracker des événements
  return null;
}

// Export des fonctions utilitaires pour les autres composants
export const useVehicleAnalytics = (vehicle: VehicleData, userId?: string) => {
  const analytics = {
    trackPartClick: (partId: number, partName: string) => {
      // Implementation similaire à trackPartClick ci-dessus
    },
    trackImageView: (imageIndex: number) => {
      // Implementation similaire à trackImageView ci-dessus
    },
    trackSearch: (searchTerm: string, resultsCount: number) => {
      // Implementation similaire à trackSearch ci-dessus
    },
    trackCustomEvent: (eventData: any) => {
      // Implementation pour événements personnalisés
    }
  };

  return analytics;
};

// Types pour TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}