/**
 * 🔗 useSeoLinkTracking Hook
 * 
 * Hook pour tracker les clics et impressions des liens internes (maillage SEO)
 * Supporte l'A/B testing des formulations (verbe+nom)
 * 
 * Usage:
 * ```tsx
 * const { trackClick, trackImpression } = useSeoLinkTracking();
 * 
 * // Track un clic avec A/B testing
 * trackClick({
 *   linkType: 'LinkGammeCar',
 *   sourceUrl: '/blog/test',
 *   destinationUrl: '/pieces/filtre.html',
 *   formula: '1:2',  // verbId:nounId
 *   targetGammeId: 45,
 * });
 * ```
 */

import { useLocation } from '@remix-run/react';
import { useCallback, useEffect, useRef } from 'react';

// Types de liens supportés
export type LinkType = 
  | 'LinkGammeCar'      // Liens vers gammes de voitures
  | 'LinkGammeCar_ID'   // Liens avec ID de gamme
  | 'LinkGamme'         // Lien gamme simple
  | 'CompSwitch'        // Composants compatibles
  | 'CrossSelling'      // Ventes croisées
  | 'VoirAussi'         // Section "Voir aussi"
  | 'Footer'            // Liens du footer
  | 'RelatedArticles'   // Articles liés
  | 'TopMarques'        // Top marques footer
  | 'GammesPopulaires'  // Gammes populaires footer
  | string;             // Support pour types custom

// Position du lien dans la page
export type LinkPosition = 
  | 'header'
  | 'content'
  | 'sidebar'
  | 'footer'
  | 'crossselling'
  | 'voiraussi';

// Interface enrichie pour A/B testing
export interface TrackClickParams {
  linkType: LinkType;
  sourceUrl: string;
  destinationUrl: string;
  anchorText?: string;
  linkPosition?: LinkPosition;
  /** Formule A/B testing: "verbId:nounId" */
  formula?: string | null;
  /** ID du verbe (SGCS_ALIAS=1) */
  switchVerbId?: number;
  /** ID du nom (SGCS_ALIAS=2) */
  switchNounId?: number;
  /** ID de la gamme cible */
  targetGammeId?: number;
}

// Legacy interface pour rétrocompatibilité
interface TrackClickOptions {
  anchorText?: string;
  position?: LinkPosition;
  /** Formule A/B testing */
  formula?: string | null;
  /** ID de la gamme cible */
  targetGammeId?: number;
}

interface UseSeoLinkTrackingReturn {
  /** Track un clic (nouvelle API avec params object) */
  trackClick: (params: TrackClickParams | LinkType, destinationUrl?: string, options?: TrackClickOptions) => void;
  /** Track une impression de liens */
  trackImpression: (linkType: LinkType, linkCount: number) => void;
  /** Créer les props pour un lien tracké */
  createTrackedLink: (linkType: LinkType, href: string, options?: TrackClickOptions) => {
    href: string;
    onClick: (e: React.MouseEvent) => void;
  };
}

// Session ID unique pour le tracking
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('seo_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('seo_session_id', sessionId);
  }
  return sessionId;
}

// Detect device type
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile';
  if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) return 'tablet';
  return 'desktop';
}

// Parse formula "verbId:nounId" into IDs
function parseFormula(formula: string | null | undefined): { verbId?: number; nounId?: number } {
  if (!formula) return {};
  const parts = formula.split(':');
  return {
    verbId: parts[0] ? parseInt(parts[0], 10) : undefined,
    nounId: parts[1] ? parseInt(parts[1], 10) : undefined,
  };
}

// Debounce pour les impressions
const impressionQueue: Map<string, { linkType: string; count: number; pageUrl: string }> = new Map();
let impressionTimeout: NodeJS.Timeout | null = null;

async function flushImpressions() {
  if (typeof window === 'undefined') return;
  
  const impressions = Array.from(impressionQueue.values());
  impressionQueue.clear();
  
  if (impressions.length === 0) return;
  
  const sessionId = getSessionId();
  
  // Envoyer les impressions groupées
  try {
    await Promise.all(
      impressions.map(({ linkType, count, pageUrl }) =>
        fetch('/api/seo/track-impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkType,
            pageUrl,
            linkCount: count,
            sessionId,
          }),
        })
      )
    );
  } catch (error) {
    // Silencieux en cas d'erreur - ne pas bloquer l'UX
    console.debug('[SEO Tracking] Impression tracking failed:', error);
  }
}

export function useSeoLinkTracking(): UseSeoLinkTrackingReturn {
  const location = useLocation();
  const currentUrl = useRef<string>('');
  
  // Mettre à jour l'URL courante
  useEffect(() => {
    currentUrl.current = location.pathname;
  }, [location.pathname]);
  
  /**
   * Track un clic sur un lien interne
   * Supporte deux API:
   * - Nouvelle: trackClick({ linkType, sourceUrl, destinationUrl, formula, ... })
   * - Legacy: trackClick('LinkGammeCar', '/destination.html', { anchorText: '...' })
   */
  const trackClick = useCallback(
    async (
      paramsOrLinkType: TrackClickParams | LinkType,
      destinationUrl?: string,
      options?: TrackClickOptions
    ) => {
      if (typeof window === 'undefined') return;
      
      const sessionId = getSessionId();
      const deviceType = getDeviceType();
      
      // Handle both APIs
      let payload: Record<string, unknown>;
      
      if (typeof paramsOrLinkType === 'object') {
        // New API: params object
        const params = paramsOrLinkType;
        const { verbId, nounId } = parseFormula(params.formula);
        
        payload = {
          linkType: params.linkType,
          sourceUrl: params.sourceUrl,
          destinationUrl: params.destinationUrl,
          anchorText: params.anchorText,
          linkPosition: params.linkPosition || 'content',
          sessionId,
          deviceType,
          userAgent: navigator.userAgent,
          referer: document.referrer || undefined,
          // A/B Testing fields
          switchVerbId: params.switchVerbId || verbId,
          switchNounId: params.switchNounId || nounId,
          switchFormula: params.formula || undefined,
          targetGammeId: params.targetGammeId,
        };
      } else {
        // Legacy API: separate arguments
        const sourceUrl = currentUrl.current || window.location.pathname;
        const { verbId, nounId } = parseFormula(options?.formula);
        
        payload = {
          linkType: paramsOrLinkType,
          sourceUrl,
          destinationUrl,
          anchorText: options?.anchorText,
          linkPosition: options?.position || 'content',
          sessionId,
          deviceType,
          userAgent: navigator.userAgent,
          // A/B Testing fields
          switchVerbId: verbId,
          switchNounId: nounId,
          switchFormula: options?.formula || undefined,
          targetGammeId: options?.targetGammeId,
        };
      }
      
      try {
        // Use sendBeacon for reliability (doesn't block navigation)
        // Use Blob with proper Content-Type for JSON parsing on backend
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], {
            type: 'application/json',
          });
          navigator.sendBeacon('/api/seo/track-click', blob);
        } else {
          // Fallback to fetch with keepalive
          fetch('/api/seo/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Ne jamais bloquer la navigation
      }
    },
    []
  );
  
  /**
   * Track une impression de liens (nombre de liens visibles)
   */
  const trackImpression = useCallback(
    (linkType: LinkType, linkCount: number) => {
      if (typeof window === 'undefined') return;
      if (linkCount <= 0) return;
      
      const pageUrl = currentUrl.current || window.location.pathname;
      const key = `${linkType}-${pageUrl}`;
      
      // Agréger les impressions du même type sur la même page
      const existing = impressionQueue.get(key);
      if (existing) {
        existing.count = Math.max(existing.count, linkCount);
      } else {
        impressionQueue.set(key, { linkType, count: linkCount, pageUrl });
      }
      
      // Debounce l'envoi
      if (impressionTimeout) {
        clearTimeout(impressionTimeout);
      }
      impressionTimeout = setTimeout(flushImpressions, 2000); // 2s après le dernier ajout
    },
    []
  );
  
  /**
   * Créer les props pour un lien tracké
   */
  const createTrackedLink = useCallback(
    (linkType: LinkType, href: string, options?: TrackClickOptions) => {
      return {
        href,
        onClick: (_e: React.MouseEvent) => {
          trackClick(linkType, href, options);
          // Ne pas empêcher la navigation
        },
      };
    },
    [trackClick]
  );
  
  return {
    trackClick,
    trackImpression,
    createTrackedLink,
  };
}

export default useSeoLinkTracking;
