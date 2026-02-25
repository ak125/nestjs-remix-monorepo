/**
 * SectionImage — Image inline pour sections de contenu.
 *
 * Composant reutilisable qui place une image dans une section
 * avec 4 modes de placement : left (float), right (float), full, center.
 *
 * Accepte n'importe quelle URL : pg_img, Supabase Storage, static asset.
 * Utilise LazyImage pour le chargement differe (below-fold).
 *
 * Responsive : mobile (< 640px) → toutes les images passent en full-width.
 * Desktop (>= 640px) → placement configure.
 *
 * @see frontend/app/config/visual-intent.ts (getSectionImageConfig)
 * @see frontend/app/components/heroes/_hero.contract.md
 */

import { LazyImage, generateImgproxySrcSet } from "~/components/ui/lazy-image";
import {
  type ImagePlacement,
  type ImageSize,
  IMAGE_SIZES,
} from "~/config/visual-intent";
import { cn } from "~/lib/utils";

interface SectionImageProps {
  /** URL de l'image (pg_img, Supabase Storage, static asset) */
  src: string;
  /** Texte alternatif (obligatoire pour accessibilite) */
  alt: string;
  /** Position dans la section (desktop seulement, mobile = full-width) */
  placement: ImagePlacement;
  /** Taille : sm (160px), md (240px), lg (400px) */
  size: ImageSize;
  /** Legende optionnelle sous l'image */
  caption?: string;
  /** Chargement immediat (pour images above-fold) */
  priority?: boolean;
  /** Classes CSS additionnelles */
  className?: string;
}

// Classes par placement — mobile-first: full-width par defaut, placement desktop via sm:
const PLACEMENT_CLASSES: Record<ImagePlacement, string> = {
  left: "w-full my-3 sm:float-left sm:w-auto sm:mr-4 sm:mb-3 sm:my-0",
  right: "w-full my-3 sm:float-right sm:w-auto sm:ml-4 sm:mb-3 sm:my-0",
  full: "w-full my-4",
  center: "w-full my-3 sm:w-auto sm:mx-auto sm:my-4 sm:block",
};

// Max-width par taille (desktop seulement via sm:)
const SIZE_CLASSES: Record<ImageSize, string> = {
  sm: "sm:max-w-[160px]",
  md: "sm:max-w-[240px]",
  lg: "sm:max-w-[400px]",
};

// Srcset widths pour images responsives
const SRCSET_WIDTHS = [160, 320, 480];

export function SectionImage({
  src,
  alt,
  placement,
  size,
  caption,
  priority = false,
  className,
}: SectionImageProps) {
  const widthPx = IMAGE_SIZES[size];
  const isFull = placement === "full";

  // Generer srcset si l'URL est compatible imgproxy
  const srcSet = generateImgproxySrcSet(src, SRCSET_WIDTHS);
  const hasSrcSet = srcSet !== src;

  return (
    <figure
      className={cn(
        PLACEMENT_CLASSES[placement],
        !isFull && SIZE_CLASSES[size],
        className,
      )}
    >
      <LazyImage
        src={src}
        alt={alt}
        width={isFull ? undefined : widthPx}
        height={isFull ? undefined : widthPx}
        priority={priority}
        objectFit="contain"
        srcSet={hasSrcSet ? srcSet : undefined}
        sizes={hasSrcSet ? `(max-width: 640px) 100vw, ${widthPx}px` : undefined}
        className={cn("rounded-lg", isFull ? "w-full max-h-[400px]" : "w-full")}
      />
      {caption && (
        <figcaption className="mt-1.5 text-xs text-gray-500 text-center leading-tight">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Wrapper qui ajoute un clearfix apres le contenu
 * quand SectionImage est en mode float (left/right).
 *
 * Usage :
 * <SectionWithImage>
 *   <SectionImage placement="left" ... />
 *   <p>Texte qui wrap autour de l'image</p>
 * </SectionWithImage>
 */
export function SectionWithImage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "after:content-[''] after:table after:clear-both",
        className,
      )}
    >
      {children}
    </div>
  );
}
