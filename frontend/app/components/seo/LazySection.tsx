import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * 🚀 LazySection - Lazy loading avec Intersection Observer
 *
 * Charge les composants uniquement quand ils deviennent visibles dans le viewport.
 * Améliore les performances LCP (Largest Contentful Paint) en différant le chargement
 * des sections non-critiques.
 *
 * @example
 * // Lazy load avec factory function
 * <LazySection
 *   loader={() => import('./ReviewsSection')}
 *   fallback={<div>Chargement des avis...</div>}
 *   threshold={0.1}
 * />
 *
 * @example
 * // Lazy load avec children
 * <LazySection fallback={<Spinner />}>
 *   <HeavyComponent data={data} />
 * </LazySection>
 */

interface LazySectionProps {
  /** Factory function pour charger le composant dynamiquement */
  loader?: () => Promise<{ default: ComponentType<any> }>;
  /** Contenu à afficher pendant le chargement */
  fallback?: ReactNode;
  /** Props à passer au composant lazy-loadé */
  componentProps?: Record<string, any>;
  /** Children à render directement (alternative à loader) */
  children?: ReactNode;
  /** Seuil de visibilité pour déclencher le chargement (0-1) */
  threshold?: number;
  /** Marge root pour l'Intersection Observer (ex: "200px") */
  rootMargin?: string;
  /** Classe CSS pour le wrapper */
  className?: string;
  /** Désactiver le lazy loading (charger immédiatement) */
  eager?: boolean;
  /** ID pour debugging */
  id?: string;
}

export function LazySection({
  loader,
  fallback = (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
  componentProps = {},
  children,
  threshold = 0.1,
  rootMargin = "200px",
  className = "",
  eager = false,
  id,
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(eager);
  const [hasLoaded, setHasLoaded] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eager) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsVisible(true);
            setHasLoaded(true);
            // Déconnecter l'observer une fois chargé
            observer.disconnect();
          }
        });
      },
      {
        threshold,
        rootMargin,
      },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [eager, hasLoaded, threshold, rootMargin, id]);

  // Si children est fourni (pas de lazy import)
  if (children) {
    return (
      <div ref={sectionRef} className={className} data-lazy-section={id}>
        {isVisible ? (
          <Suspense fallback={fallback}>{children}</Suspense>
        ) : (
          <div className="min-h-[200px]">
            {/* Placeholder pour éviter le layout shift */}
          </div>
        )}
      </div>
    );
  }

  // Si loader est fourni (lazy import)
  if (!loader) {
    console.error(
      'LazySection: Vous devez fournir soit "loader" soit "children"',
    );
    return null;
  }

  const LazyComponent = lazy(loader);

  return (
    <div ref={sectionRef} className={className} data-lazy-section={id}>
      {isVisible ? (
        <Suspense fallback={fallback}>
          <LazyComponent {...componentProps} />
        </Suspense>
      ) : (
        <div className="min-h-[200px]">
          {/* Placeholder pour éviter le layout shift */}
        </div>
      )}
    </div>
  );
}

/**
 * 🎯 LazySectionSkeleton - Squelette de chargement réutilisable
 *
 * Affiche un skeleton loader pendant le chargement des sections lazy.
 *
 * @example
 * <LazySection
 *   loader={() => import('./ProductGrid')}
 *   fallback={<LazySectionSkeleton rows={3} />}
 * />
 */
interface LazySectionSkeletonProps {
  /** Nombre de lignes dans le skeleton */
  rows?: number;
  /** Hauteur de chaque ligne */
  height?: string;
  /** Classe CSS supplémentaire */
  className?: string;
}

export function LazySectionSkeleton({
  rows = 3,
  height = "h-24",
  className = "",
}: LazySectionSkeletonProps) {
  return (
    <div className={`space-y-4 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`bg-gray-200 rounded-lg ${height}`} />
      ))}
    </div>
  );
}

/**
 * 🎯 LazyCard - Carte lazy avec placeholder
 *
 * Variante de LazySection optimisée pour les cartes de produits.
 */
interface LazyCardProps {
  loader: () => Promise<{ default: ComponentType<any> }>;
  componentProps?: Record<string, any>;
  className?: string;
  eager?: boolean;
}

export function LazyCard({
  loader,
  componentProps,
  className,
  eager,
}: LazyCardProps) {
  return (
    <LazySection
      loader={loader}
      componentProps={componentProps}
      className={className}
      eager={eager}
      fallback={
        <div className="bg-white rounded-lg shadow-md p-4 animate-pulse">
          <div className="bg-gray-200 h-48 rounded mb-4"></div>
          <div className="bg-gray-200 h-4 rounded mb-2"></div>
          <div className="bg-gray-200 h-4 rounded w-2/3"></div>
        </div>
      }
      threshold={0.05}
      rootMargin="300px"
    />
  );
}

/**
 * 🎯 useInView - Hook personnalisé pour détecter la visibilité
 *
 * @example
 * const { ref, isInView } = useInView({ threshold: 0.5 });
 *
 * return (
 *   <div ref={ref}>
 *     {isInView ? <HeavyComponent /> : <Placeholder />}
 *   </div>
 * );
 */
interface UseInViewOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useInView({
  threshold = 0.1,
  rootMargin = "0px",
  triggerOnce = true,
}: UseInViewOptions = {}) {
  const [isInView, setIsInView] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (triggerOnce && hasTriggered) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            if (triggerOnce) {
              setHasTriggered(true);
              observer.disconnect();
            }
          } else if (!triggerOnce) {
            setIsInView(false);
          }
        });
      },
      { threshold, rootMargin },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, hasTriggered]);

  return { ref, isInView };
}
