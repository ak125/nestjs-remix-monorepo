/**
 * useConversionTracking - Hook analytics pour optimisation conversion
 * 
 * Fonctionnalités:
 * - Track clics CTA avec contexte
 * - Mesure temps avant conversion
 * - Support A/B testing
 * - Heatmap data (coordonnées clics)
 * - Funnel tracking (étapes parcours)
 * - Session replay metadata
 * 
 * @example
 * ```tsx
 * const { trackCTAClick, trackConversion, startFunnel } = useConversionTracking();
 * 
 * // Track CTA
 * <button onClick={(e) => {
 *   trackCTAClick('add-to-cart', { productId: '123' }, e);
 *   addToCart();
 * }}>
 *   Ajouter au panier
 * </button>
 * 
 * // Track conversion
 * trackConversion('purchase', { orderId, total, items });
 * ```
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ConversionEvent {
  /** Type d'événement */
  type: 'cta_click' | 'conversion' | 'funnel_step' | 'abandonment';
  
  /** Label de l'action */
  label: string;
  
  /** Timestamp */
  timestamp: number;
  
  /** Métadonnées */
  metadata?: Record<string, unknown>;
  
  /** Coordonnées clic (heatmap) */
  clickPosition?: { x: number; y: number };
  
  /** Temps depuis début session (ms) */
  timeInSession?: number;
  
  /** Variant A/B test */
  variant?: string;
}

export interface FunnelStep {
  /** Nom de l'étape */
  step: string;
  
  /** Timestamp entrée */
  enteredAt: number;
  
  /** Timestamp sortie */
  exitedAt?: number;
  
  /** Durée dans l'étape (ms) */
  duration?: number;
  
  /** Complétée ou abandonnée */
  completed: boolean;
}

export interface ConversionSession {
  /** ID session */
  sessionId: string;
  
  /** Timestamp début */
  startedAt: number;
  
  /** Variant A/B test */
  abVariant?: string;
  
  /** Événements */
  events: ConversionEvent[];
  
  /** Funnel actif */
  funnel?: FunnelStep[];
  
  /** Converti (oui/non) */
  converted: boolean;
  
  /** Temps avant conversion (ms) */
  timeToConversion?: number;
  
  /** Valeur conversion */
  conversionValue?: number;
}

export interface UseConversionTrackingOptions {
  /** ID session personnalisé */
  sessionId?: string;
  
  /** Variant A/B test */
  abVariant?: string;
  
  /** Activer heatmap tracking */
  enableHeatmap?: boolean;
  
  /** Activer funnel tracking */
  enableFunnel?: boolean;
  
  /** Provider analytics (GA4, Mixpanel, custom) */
  provider?: 'gtag' | 'mixpanel' | 'plausible' | 'custom';
  
  /** Callback custom pour événements */
  onEvent?: (event: ConversionEvent) => void;
  
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useConversionTracking(options: UseConversionTrackingOptions = {}) {
  const {
    sessionId: customSessionId,
    abVariant,
    enableHeatmap = true,
    enableFunnel = true,
    provider = 'gtag',
    onEvent,
    debug = false,
  } = options;

  // ========================================
  // STATE
  // ========================================
  const [session, setSession] = useState<ConversionSession>(() => {
    const sessionId = customSessionId || generateSessionId();
    return {
      sessionId,
      startedAt: Date.now(),
      abVariant,
      events: [],
      converted: false,
    };
  });

  const sessionStartRef = useRef(Date.now());
  const currentFunnelStepRef = useRef<string | null>(null);

  // ========================================
  // PERSISTANCE (LOCALSTORAGE)
  // ========================================
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Sauvegarder session
    const saveSession = () => {
      try {
        sessionStorage.setItem('conversionSession', JSON.stringify(session));
      } catch (err) {
        if (debug) console.error('Failed to save session:', err);
      }
    };

    saveSession();
  }, [session, debug]);

  // ========================================
  // TRACK CTA CLICK
  // ========================================
  const trackCTAClick = useCallback(
    (
      label: string,
      metadata?: Record<string, unknown>,
      mouseEvent?: React.MouseEvent<HTMLElement>
    ) => {
      const clickPosition = enableHeatmap && mouseEvent
        ? {
            x: mouseEvent.clientX,
            y: mouseEvent.clientY,
          }
        : undefined;

      const event: ConversionEvent = {
        type: 'cta_click',
        label,
        timestamp: Date.now(),
        timeInSession: Date.now() - sessionStartRef.current,
        variant: session.abVariant,
        metadata,
        clickPosition,
      };

      // Ajouter à session
      setSession((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }));

      // Envoyer au provider
      sendToProvider(provider, event, debug);

      // Callback custom
      if (onEvent) onEvent(event);

      if (debug) {
        console.log('[ConversionTracking] CTA Click:', event);
      }
    },
    [enableHeatmap, session.abVariant, provider, onEvent, debug]
  );

  // ========================================
  // TRACK CONVERSION
  // ========================================
  const trackConversion = useCallback(
    (label: string, metadata?: Record<string, unknown>) => {
      const timeToConversion = Date.now() - sessionStartRef.current;

      const event: ConversionEvent = {
        type: 'conversion',
        label,
        timestamp: Date.now(),
        timeInSession: timeToConversion,
        variant: session.abVariant,
        metadata,
      };

      setSession((prev) => ({
        ...prev,
        events: [...prev.events, event],
        converted: true,
        timeToConversion,
        conversionValue: (metadata?.value as number) || undefined,
      }));

      // Envoyer au provider
      sendToProvider(provider, event, debug);

      // Callback custom
      if (onEvent) onEvent(event);

      if (debug) {
        console.log('[ConversionTracking] Conversion:', {
          ...event,
          timeToConversion: `${(timeToConversion / 1000).toFixed(1)}s`,
        });
      }
    },
    [session.abVariant, provider, onEvent, debug]
  );

  // ========================================
  // FUNNEL TRACKING
  // ========================================
  const startFunnel = useCallback(
    (steps: string[]) => {
      if (!enableFunnel) return;

      setSession((prev) => ({
        ...prev,
        funnel: steps.map((step) => ({
          step,
          enteredAt: 0,
          completed: false,
        })),
      }));

      if (debug) {
        console.log('[ConversionTracking] Funnel started:', steps);
      }
    },
    [enableFunnel, debug]
  );

  const enterFunnelStep = useCallback(
    (stepName: string) => {
      if (!enableFunnel) return;

      const now = Date.now();

      setSession((prev) => {
        if (!prev.funnel) return prev;

        const stepIndex = prev.funnel.findIndex((s) => s.step === stepName);
        if (stepIndex === -1) return prev;

        const updatedFunnel = [...prev.funnel];
        updatedFunnel[stepIndex] = {
          ...updatedFunnel[stepIndex],
          enteredAt: now,
        };

        return { ...prev, funnel: updatedFunnel };
      });

      currentFunnelStepRef.current = stepName;

      const event: ConversionEvent = {
        type: 'funnel_step',
        label: `entered_${stepName}`,
        timestamp: now,
        timeInSession: now - sessionStartRef.current,
        variant: session.abVariant,
      };

      sendToProvider(provider, event, debug);

      if (debug) {
        console.log('[ConversionTracking] Entered funnel step:', stepName);
      }
    },
    [enableFunnel, session.abVariant, provider, debug]
  );

  const completeFunnelStep = useCallback(
    (stepName: string) => {
      if (!enableFunnel) return;

      const now = Date.now();

      setSession((prev) => {
        if (!prev.funnel) return prev;

        const stepIndex = prev.funnel.findIndex((s) => s.step === stepName);
        if (stepIndex === -1) return prev;

        const step = prev.funnel[stepIndex];
        const duration = now - step.enteredAt;

        const updatedFunnel = [...prev.funnel];
        updatedFunnel[stepIndex] = {
          ...step,
          exitedAt: now,
          duration,
          completed: true,
        };

        return { ...prev, funnel: updatedFunnel };
      });

      currentFunnelStepRef.current = null;

      const event: ConversionEvent = {
        type: 'funnel_step',
        label: `completed_${stepName}`,
        timestamp: now,
        timeInSession: now - sessionStartRef.current,
        variant: session.abVariant,
      };

      sendToProvider(provider, event, debug);

      if (debug) {
        console.log('[ConversionTracking] Completed funnel step:', stepName);
      }
    },
    [enableFunnel, session.abVariant, provider, debug]
  );

  const abandonFunnel = useCallback(
    (reason?: string) => {
      if (!enableFunnel) return;

      const event: ConversionEvent = {
        type: 'abandonment',
        label: 'funnel_abandoned',
        timestamp: Date.now(),
        timeInSession: Date.now() - sessionStartRef.current,
        variant: session.abVariant,
        metadata: {
          reason,
          currentStep: currentFunnelStepRef.current,
        },
      };

      sendToProvider(provider, event, debug);

      if (debug) {
        console.log('[ConversionTracking] Funnel abandoned:', reason);
      }
    },
    [enableFunnel, session.abVariant, provider, debug]
  );

  // ========================================
  // GETTERS
  // ========================================
  const getSessionStats = useCallback(() => {
    const totalEvents = session.events.length;
    const ctaClicks = session.events.filter((e) => e.type === 'cta_click').length;
    const conversions = session.events.filter((e) => e.type === 'conversion').length;
    const sessionDuration = Date.now() - sessionStartRef.current;

    return {
      sessionId: session.sessionId,
      abVariant: session.abVariant,
      totalEvents,
      ctaClicks,
      conversions,
      sessionDuration,
      timeToConversion: session.timeToConversion,
      converted: session.converted,
      conversionValue: session.conversionValue,
      funnelCompletion: session.funnel
        ? (session.funnel.filter((s) => s.completed).length / session.funnel.length) * 100
        : 0,
    };
  }, [session]);

  // ========================================
  // RETURN
  // ========================================
  return {
    // Core tracking
    trackCTAClick,
    trackConversion,
    
    // Funnel tracking
    startFunnel,
    enterFunnelStep,
    completeFunnelStep,
    abandonFunnel,
    
    // Getters
    getSessionStats,
    session,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateSessionId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sendToProvider(
  provider: UseConversionTrackingOptions['provider'],
  event: ConversionEvent,
  debug?: boolean
) {
  if (typeof window === 'undefined') return;

  try {
    switch (provider) {
      case 'gtag':
        if ((window as any).gtag) {
          (window as any).gtag('event', event.type, {
            event_label: event.label,
            variant: event.variant,
            ...event.metadata,
          });
        }
        break;

      case 'mixpanel':
        if ((window as any).mixpanel) {
          (window as any).mixpanel.track(event.type, {
            label: event.label,
            variant: event.variant,
            timestamp: event.timestamp,
            ...event.metadata,
          });
        }
        break;

      case 'plausible':
        if ((window as any).plausible) {
          (window as any).plausible(event.label, {
            props: {
              type: event.type,
              variant: event.variant,
              ...event.metadata,
            },
          });
        }
        break;

      case 'custom':
        // Utiliser onEvent callback
        break;

      default:
        if (debug) {
          console.warn('[ConversionTracking] Unknown provider:', provider);
        }
    }
  } catch (err) {
    if (debug) {
      console.error('[ConversionTracking] Provider error:', err);
    }
  }
}

// ============================================================================
// HOOK A/B TESTING
// ============================================================================

export function useABTest(testName: string, variants: string[]): string {
  const [variant] = useState<string>(() => {
    if (typeof window === 'undefined') return variants[0];

    // Vérifier si variant déjà assigné
    const stored = sessionStorage.getItem(`ab_test_${testName}`);
    if (stored && variants.includes(stored)) {
      return stored;
    }

    // Assigner aléatoirement
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];
    sessionStorage.setItem(`ab_test_${testName}`, randomVariant);
    return randomVariant;
  });

  return variant;
}

// ============================================================================
// HOOK HEATMAP
// ============================================================================

export function useHeatmapTracking() {
  const clicksRef = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);

  const trackClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    clicksRef.current.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
    });

    // Limiter à 1000 clics max
    if (clicksRef.current.length > 1000) {
      clicksRef.current.shift();
    }
  }, []);

  const getHeatmapData = useCallback(() => {
    return [...clicksRef.current];
  }, []);

  const clearHeatmapData = useCallback(() => {
    clicksRef.current = [];
  }, []);

  return {
    trackClick,
    getHeatmapData,
    clearHeatmapData,
  };
}

// ============================================================================
// CONTEXT (OPTIONNEL)
// ============================================================================

interface ConversionTrackingContextValue {
  trackCTAClick: ReturnType<typeof useConversionTracking>['trackCTAClick'];
  trackConversion: ReturnType<typeof useConversionTracking>['trackConversion'];
  startFunnel: ReturnType<typeof useConversionTracking>['startFunnel'];
  enterFunnelStep: ReturnType<typeof useConversionTracking>['enterFunnelStep'];
  completeFunnelStep: ReturnType<typeof useConversionTracking>['completeFunnelStep'];
  abandonFunnel: ReturnType<typeof useConversionTracking>['abandonFunnel'];
  getSessionStats: ReturnType<typeof useConversionTracking>['getSessionStats'];
}

const ConversionTrackingContext = createContext<ConversionTrackingContextValue | null>(null);

export function ConversionTrackingProvider({
  children,
  options = {},
}: {
  children: ReactNode;
  options?: UseConversionTrackingOptions;
}) {
  const tracking = useConversionTracking(options);

  return (
    <ConversionTrackingContext.Provider value={tracking}>
      {children}
    </ConversionTrackingContext.Provider>
  );
}

export function useConversionTrackingContext() {
  const context = useContext(ConversionTrackingContext);
  if (!context) {
    throw new Error('useConversionTrackingContext must be used within ConversionTrackingProvider');
  }
  return context;
}
