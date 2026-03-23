/**
 * R1SlotImage — Composant image responsive pour les slots R1.
 * Utilise ImageOptimizer (même pipeline AVIF/WebP que tout le site).
 */
import { useState } from "react";
import { ImageOptimizer } from "~/utils/image-optimizer";

// Classes statiques — Tailwind JIT les détecte au build
const ASPECT_CLASSES: Record<string, string> = {
  "4:3": "aspect-[4/3]",
  "4/3": "aspect-[4/3]",
  "16:9": "aspect-[16/9]",
  "16/9": "aspect-[16/9]",
  "1200:630": "aspect-[1200/630]",
  "1200/630": "aspect-[1200/630]",
};

interface R1SlotImageProps {
  path: string;
  alt: string;
  caption?: string | null;
  /** Fallback alt si alt est vide : caption → fallbackAlt → "Image" */
  fallbackAlt?: string;
  aspect?: string;
  className?: string;
  loading?: "lazy" | "eager";
  widths?: number[];
  quality?: number;
  sizes?: string;
}

export function R1SlotImage({
  path,
  alt,
  caption,
  fallbackAlt,
  aspect = "4/3",
  className = "",
  loading = "lazy",
  widths = [400, 640],
  quality = 85,
  sizes = "(max-width: 640px) 100vw, 640px",
}: R1SlotImageProps) {
  const [error, setError] = useState(false);

  if (error || !path) return null;

  // Fallback alt chain: alt → caption → fallbackAlt → "Image"
  const resolvedAlt = alt || caption || fallbackAlt || "Image";

  const imgSet = ImageOptimizer.getPictureImageSet(path, {
    widths,
    quality,
    sizes,
  });

  const aspectClass = ASPECT_CLASSES[aspect] ?? "aspect-[4/3]";

  return (
    <figure className={`my-6 ${className}`}>
      <picture>
        <source srcSet={imgSet.avifSrcSet} sizes={sizes} type="image/avif" />
        <source srcSet={imgSet.webpSrcSet} sizes={sizes} type="image/webp" />
        <img
          src={imgSet.fallbackSrc}
          alt={resolvedAlt}
          loading={loading}
          decoding="async"
          onError={() => setError(true)}
          className={`w-full rounded-xl object-contain ${aspectClass}`}
        />
      </picture>
      {caption && (
        <figcaption className="text-xs text-slate-400 mt-1.5 text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
