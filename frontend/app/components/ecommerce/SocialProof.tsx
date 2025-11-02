/**
 * SocialProof - Composants de preuve sociale pour conversion
 * 
 * Principes psychologiques:
 * - Preuve sociale = +34% de confiance
 * - Nombres spécifiques = crédibilité
 * - Animation compteur = engagement visuel
 * - Trust indicators = réassurance
 * 
 * @example
 * ```tsx
 * <SalesCounter count={12847} label="Pièces vendues ce mois" />
 * <RecentPurchases count={23} timeframe="dernières 24h" />
 * <TrustBadge type="verified-seller" count={4.8} reviews={2341} />
 * ```
 */

import { useState, useEffect, type ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface SalesCounterProps {
  /** Nombre total (sera animé) */
  count: number;
  
  /** Label descriptif */
  label: string;
  
  /** Période de temps (optionnel) */
  timeframe?: string;
  
  /** Icône (optionnel) */
  icon?: ReactNode;
  
  /** Variant visuel */
  variant?: 'compact' | 'expanded' | 'hero';
  
  /** Durée animation (ms) */
  animationDuration?: number;
  
  /** Couleur d'accentuation */
  accentColor?: 'primary' | 'success' | 'warning';
}

export interface RecentPurchasesProps {
  /** Nombre d'achats récents */
  count: number;
  
  /** Période (ex: "dernières 24h") */
  timeframe: string;
  
  /** Nom du produit (optionnel) */
  productName?: string;
  
  /** Afficher animation pulse */
  animated?: boolean;
}

export interface TrustBadgeProps {
  /** Type de badge */
  type: 'verified-seller' | 'top-rated' | 'fast-shipping' | 'quality-guaranteed' | 'secure-payment';
  
  /** Note (sur 5) */
  rating?: number;
  
  /** Nombre d'avis */
  reviewCount?: number;
  
  /** Taille */
  size?: 'small' | 'medium' | 'large';
  
  /** Afficher détails */
  showDetails?: boolean;
}

export interface LiveActivityProps {
  /** Messages d'activité en direct */
  activities: ActivityMessage[];
  
  /** Durée d'affichage par message (ms) */
  displayDuration?: number;
  
  /** Afficher avatar générique */
  showAvatar?: boolean;
}

export interface ActivityMessage {
  id: string;
  message: string;
  timestamp?: Date;
  location?: string;
}

// ============================================================================
// COMPTEUR DE VENTES (ANIMATION)
// ============================================================================

export function SalesCounter({
  count,
  label,
  timeframe,
  icon,
  variant = 'compact',
  animationDuration = 2000,
  accentColor = 'primary',
}: SalesCounterProps) {
  const [displayCount, setDisplayCount] = useState(0);

  // Animation compteur (easing)
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / animationDuration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setDisplayCount(Math.floor(count * easeOut));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [count, animationDuration]);

  // Formatage nombre (ex: 12847 → 12 847)
  const formattedCount = displayCount.toLocaleString('fr-FR');

  // Classes selon variant
  const containerClasses = 
    variant === 'hero' 
      ? 'flex flex-col items-center gap-2 p-8 bg-gradient-to-br from-[#F5F7FA] to-white rounded-xl shadow-lg' 
      : variant === 'expanded' 
        ? 'flex flex-col items-center gap-2 p-6 bg-[#F5F7FA] rounded-lg' 
        : 'inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-[#E5E7EB]';

  const countClasses = 
    variant === 'hero' 
      ? 'text-5xl font-heading font-bold' 
      : variant === 'expanded' 
        ? 'text-3xl font-heading font-bold' 
        : 'text-xl font-heading font-bold';

  const accentColors = {
    primary: 'text-[#FF3B30]',
    success: 'text-[#27AE60]',
    warning: 'text-[#F39C12]',
  };

  return (
    <div className={containerClasses}>
      {icon && <div className="text-2xl">{icon}</div>}
      
      <div className={`${countClasses} ${accentColors[accentColor]}`}>
        {formattedCount}
      </div>
      
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-sans text-[#6B7280]">{label}</span>
        {timeframe && (
          <span className="text-xs font-sans text-[#9CA3AF]">{timeframe}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACHATS RÉCENTS (URGENCE)
// ============================================================================

export function RecentPurchases({
  count,
  timeframe,
  productName,
  animated = true,
}: RecentPurchasesProps) {
  const pulseClass = animated ? 'animate-pulse-soft' : '';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-[#FFF3E0] border-l-4 border-[#F39C12] rounded-lg ${pulseClass}`}>
      <div className="flex-shrink-0">
        <svg className="w-6 h-6 text-[#F39C12]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
      </div>
      
      <div className="flex-1">
        <p className="text-sm font-sans font-semibold text-[#6B7280]">
          <span className="text-[#F39C12] font-heading font-bold">{count}</span>
          {' '}
          {productName ? (
            <>personne{count > 1 ? 's ont acheté' : ' a acheté'} <span className="font-medium">{productName}</span></>
          ) : (
            <>achat{count > 1 ? 's' : ''}</>
          )}
        </p>
        <p className="text-xs font-sans text-[#9CA3AF] mt-0.5">
          {timeframe}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// BADGES DE CONFIANCE
// ============================================================================

const TRUST_BADGE_CONFIG = {
  'verified-seller': {
    icon: '✓',
    label: 'Vendeur vérifié',
    color: 'bg-[#27AE60]',
    textColor: 'text-white',
  },
  'top-rated': {
    icon: '⭐',
    label: 'Meilleure note',
    color: 'bg-[#F39C12]',
    textColor: 'text-white',
  },
  'fast-shipping': {
    icon: '⚡',
    label: 'Expédition rapide',
    color: 'bg-[#0F4C81]',
    textColor: 'text-white',
  },
  'quality-guaranteed': {
    icon: '💎',
    label: 'Qualité garantie',
    color: 'bg-[#8E44AD]',
    textColor: 'text-white',
  },
  'secure-payment': {
    icon: '🔒',
    label: 'Paiement sécurisé',
    color: 'bg-[#27AE60]',
    textColor: 'text-white',
  },
} as const;

export function TrustBadge({
  type,
  rating,
  reviewCount,
  size = 'medium',
  showDetails = true,
}: TrustBadgeProps) {
  const config = TRUST_BADGE_CONFIG[type];

  const sizeClasses = 
    size === 'large' 
      ? 'px-6 py-3 text-base gap-3' 
      : size === 'small' 
        ? 'px-3 py-1.5 text-xs gap-1.5' 
        : 'px-4 py-2 text-sm gap-2';

  return (
    <div className={`inline-flex items-center ${sizeClasses} ${config.color} ${config.textColor} rounded-lg font-sans font-semibold shadow-md`}>
      <span className="text-xl">{config.icon}</span>
      <span>{config.label}</span>
      
      {showDetails && rating && (
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-white/30">
          <span className="font-heading font-bold">{rating.toFixed(1)}</span>
          <span className="text-xs opacity-80">/ 5</span>
          {reviewCount && (
            <span className="text-xs opacity-80">({reviewCount.toLocaleString('fr-FR')})</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ACTIVITÉ EN DIRECT (FOMO)
// ============================================================================

export function LiveActivity({
  activities,
  displayDuration = 5000,
  showAvatar = true,
}: LiveActivityProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (activities.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, displayDuration);

    return () => clearInterval(interval);
  }, [activities.length, displayDuration]);

  if (activities.length === 0) return null;

  const currentActivity = activities[currentIndex];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-[#E5E7EB] rounded-lg shadow-sm animate-slide-in">
      {showAvatar && (
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[#FF3B30] to-[#FF6B30] rounded-full flex items-center justify-center text-white font-heading font-bold">
          👤
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans text-[#374151] truncate">
          {currentActivity.message}
        </p>
        
        <div className="flex items-center gap-2 mt-1">
          {currentActivity.timestamp && (
            <span className="text-xs font-sans text-[#9CA3AF]">
              {formatTimeAgo(currentActivity.timestamp)}
            </span>
          )}
          {currentActivity.location && (
            <>
              <span className="text-[#D1D5DB]">•</span>
              <span className="text-xs font-sans text-[#9CA3AF]">
                {currentActivity.location}
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-shrink-0">
        <div className="w-2 h-2 bg-[#27AE60] rounded-full animate-pulse" />
      </div>
    </div>
  );
}

// ============================================================================
// GROUPE DE PREUVES SOCIALES
// ============================================================================

interface SocialProofGroupProps {
  children: ReactNode;
  layout?: 'horizontal' | 'vertical' | 'grid';
  spacing?: 'compact' | 'comfortable' | 'spacious';
}

export function SocialProofGroup({ 
  children, 
  layout = 'vertical', 
  spacing = 'comfortable' 
}: SocialProofGroupProps) {
  const gapClasses = {
    compact: 'gap-2',
    comfortable: 'gap-4',
    spacious: 'gap-6',
  };

  const layoutClasses = 
    layout === 'horizontal' 
      ? `flex flex-row flex-wrap items-center justify-center ${gapClasses[spacing]}` 
      : layout === 'grid' 
        ? `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${gapClasses[spacing]}` 
        : `flex flex-col ${gapClasses[spacing]}`;

  return (
    <div className={layoutClasses}>
      {children}
    </div>
  );
}

// ============================================================================
// STATISTIQUE INLINE (DANS TEXTE)
// ============================================================================

interface InlineStatProps {
  value: number | string;
  label: string;
  highlight?: boolean;
}

export function InlineStat({ value, label, highlight = true }: InlineStatProps) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-heading font-bold ${highlight ? 'text-[#FF3B30]' : 'text-[#374151]'} text-lg`}>
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </span>
      <span className="font-sans text-sm text-[#6B7280]">{label}</span>
    </span>
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `Il y a ${diffDays}j`;
}

// ============================================================================
// CSS ANIMATIONS
// ============================================================================

export const socialProofStyles = `
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;
