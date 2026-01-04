/**
 * 🦸 HeroSection - Composant Hero Réutilisable
 *
 * Unifie les patterns hero de la codebase (Homepage, Gamme, Search, Brand)
 * Mobile-first avec gradients, VehicleSelector optionnel, et TrustBadges.
 *
 * @example
 * ```tsx
 * // Homepage
 * <HeroSection variant="home" title="..." showVehicleSelector showTrustBadges />
 *
 * // Gamme
 * <HeroSection variant="gamme" title={gammeName} breadcrumbs={crumbs} />
 *
 * // Search
 * <HeroSection variant="search" title="Recherche" subtitle={`${count} résultats`} />
 * ```
 */

import React from 'react';
import { CheckCircle2, Truck, Shield, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

// Types pour les breadcrumbs
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeroSectionProps {
  /** Variante de layout: home (2 colonnes), gamme, vehicle, search, brand */
  variant?: 'home' | 'gamme' | 'vehicle' | 'search' | 'brand' | 'minimal';
  /** Titre principal (H1) */
  title: string;
  /** Sous-titre optionnel */
  subtitle?: string;
  /** Fil d'Ariane */
  breadcrumbs?: BreadcrumbItem[];
  /** Afficher le sélecteur de véhicule */
  showVehicleSelector?: boolean;
  /** Afficher les badges de confiance */
  showTrustBadges?: boolean;
  /** Gradient de fond */
  backgroundGradient?: 'blue' | 'dark' | 'light' | 'none';
  /** Compteur (pour search/listing) */
  count?: number;
  /** Icône à afficher (pour search) */
  icon?: React.ReactNode;
  /** Contenu supplémentaire */
  children?: React.ReactNode;
  /** Classes CSS additionnelles */
  className?: string;
}

// Gradients disponibles
const GRADIENTS = {
  blue: 'bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900',
  dark: 'bg-gradient-to-br from-slate-900 to-slate-800',
  light: 'bg-gradient-to-br from-blue-50 to-white',
  none: '',
} as const;

// Composant TrustBadges interne
function TrustBadges() {
  const badges = [
    { icon: CheckCircle2, label: 'Qualité garantie' },
    { icon: Truck, label: 'Livraison rapide' },
    { icon: Shield, label: 'Paiement sécurisé' },
    { icon: Users, label: '+59 000 clients' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-8 pt-6 border-t border-white/20">
      {badges.map((badge, idx) => (
        <div key={idx} className="flex items-center gap-2 text-white/80 text-sm">
          <badge.icon className="h-4 w-4 text-green-400" />
          <span>{badge.label}</span>
        </div>
      ))}
    </div>
  );
}

// Composant Breadcrumbs interne
function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Fil d'Ariane" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-white/70">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {idx > 0 && <span className="text-white/40">/</span>}
            {item.href ? (
              <a
                href={item.href}
                className="hover:text-white hover:underline transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-white">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function HeroSection({
  variant = 'minimal',
  title,
  subtitle,
  breadcrumbs,
  showVehicleSelector = false,
  showTrustBadges = false,
  backgroundGradient = 'blue',
  count,
  icon,
  children,
  className,
}: HeroSectionProps) {
  // Déterminer le gradient en fonction du variant si non spécifié
  const effectiveGradient = backgroundGradient === 'blue'
    ? variant === 'search' ? 'dark' : 'blue'
    : backgroundGradient;

  // Classes de texte en fonction du gradient
  const textColorClass = effectiveGradient === 'light'
    ? 'text-gray-900'
    : 'text-white';

  const subtitleColorClass = effectiveGradient === 'light'
    ? 'text-gray-600'
    : 'text-white/80';

  // Padding responsive
  const paddingClass = variant === 'home'
    ? 'py-12 lg:py-20'
    : variant === 'minimal'
      ? 'py-8 lg:py-12'
      : 'py-8 lg:py-16';

  return (
    <section
      className={cn(
        GRADIENTS[effectiveGradient],
        paddingClass,
        className
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} />
        )}

        {/* Layout principal */}
        <div
          className={cn(
            variant === 'home' && 'lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center',
            variant === 'search' && 'text-center max-w-3xl mx-auto'
          )}
        >
          {/* Contenu textuel */}
          <div className={variant === 'search' ? '' : ''}>
            {/* Icône (pour search) */}
            {icon && (
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                {icon}
              </div>
            )}

            {/* Titre H1 */}
            <h1
              className={cn(
                'font-bold',
                textColorClass,
                variant === 'home'
                  ? 'text-3xl md:text-4xl lg:text-5xl'
                  : variant === 'search'
                    ? 'text-2xl md:text-3xl lg:text-4xl'
                    : 'text-2xl md:text-3xl lg:text-4xl'
              )}
            >
              {title}
            </h1>

            {/* Sous-titre */}
            {subtitle && (
              <p
                className={cn(
                  'mt-4 text-lg md:text-xl',
                  subtitleColorClass
                )}
              >
                {subtitle}
              </p>
            )}

            {/* Compteur */}
            {typeof count === 'number' && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <span
                  className={cn(
                    'text-2xl md:text-3xl font-bold',
                    effectiveGradient === 'light' ? 'text-blue-600' : 'text-white'
                  )}
                >
                  {count.toLocaleString('fr-FR')}
                </span>
                <span className={subtitleColorClass}>
                  résultat{count > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* VehicleSelector placeholder */}
          {showVehicleSelector && (
            <div className="mt-8 lg:mt-0">
              {/* Le VehicleSelectorV2 sera injecté via children ou importé par la route */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <p className="text-white/60 text-sm text-center">
                  Sélecteur de véhicule (injecter via children)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Contenu enfant */}
        {children}

        {/* Trust Badges */}
        {showTrustBadges && <TrustBadges />}
      </div>
    </section>
  );
}

export default HeroSection;
